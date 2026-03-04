from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.pagination import PageNumberPagination
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
import secrets
from django.db.models import Q, Avg, Count
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
from .models import Product, Category, Profile, Order, EmailVerificationCode, ProductRating
from .moysklad import MoySkladClient, MoySkladError, MoySkladConfigError
from .moysklad_sync import _extract_image_url
from .serializers import (
    ProductSerializer,
    CategorySerializer,
    RegisterSerializer,
    LoginSerializer,
    EmailCodeSendSerializer,
    EmailCodeVerifySerializer,
    ProfileUpdateSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    OrderListSerializer,
    ProductRatingSerializer,
    ProductRatingCreateSerializer,
)


def _email_code_ttl():
    return int(getattr(settings, 'EMAIL_CODE_TTL_MINUTES', 10))


def _generate_email_code():
    return f"{secrets.randbelow(10**6):06d}"


def _purge_expired_codes():
    cutoff = timezone.now() - timedelta(minutes=_email_code_ttl())
    EmailVerificationCode.objects.filter(created_at__lt=cutoff).delete()


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_queryset(self):
        if getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            return Category.objects.filter(slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo"))
        return Category.objects.all()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    class CatalogPagination(PageNumberPagination):
        page_size = 30
        page_size_query_param = "page_size"
        max_page_size = 60

    queryset = Product.objects.annotate(
        rating_avg=Avg('ratings__rating'),
        rating_count=Count('ratings')
    )
    serializer_class = ProductSerializer
    pagination_class = CatalogPagination

    def get_queryset(self):
        if getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            return Product.objects.filter(
                moysklad_id__isnull=False,
                category__slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo"),
            ).annotate(
                rating_avg=Avg('ratings__rating'),
                rating_count=Count('ratings')
            ).order_by('-created_at', '-id')

        # Фильтрация товаров через параметры URL
        # Пример: /api/products/?is_new=true&category=face&category=body
        # Поддерживает множественный выбор категорий
        queryset = Product.objects.annotate(
            rating_avg=Avg('ratings__rating'),
            rating_count=Count('ratings')
        ).order_by('-created_at', '-id')
        
        is_new = self.request.query_params.get('is_new', None)
        is_bestseller = self.request.query_params.get('is_bestseller', None)
        # Получаем все значения параметра category (может быть несколько)
        category_slugs = self.request.query_params.getlist('category')

        if is_new == 'true':
            queryset = queryset.filter(is_new=True)
        
        if is_bestseller == 'true':
            queryset = queryset.filter(is_bestseller=True)

        if category_slugs:
            # Фильтруем по всем выбранным категориям (OR логика)
            queryset = queryset.filter(category__slug__in=category_slugs)

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


@api_view(['GET'])
@permission_classes([AllowAny])
def product_ratings(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    ratings = ProductRating.objects.filter(product=product).select_related('user')
    return Response(ProductRatingSerializer(ratings, many=True).data, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def rate_product(request, product_id):
    serializer = ProductRatingCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    product = get_object_or_404(Product, id=product_id)
    rating_value = serializer.validated_data['rating']
    comment = serializer.validated_data.get('comment', '').strip()

    rating_obj, created = ProductRating.objects.update_or_create(
        product=product,
        user=request.user,
        defaults={'rating': rating_value, 'comment': comment},
    )

    stats = ProductRating.objects.filter(product=product).aggregate(
        rating_avg=Avg('rating'),
        rating_count=Count('id'),
    )

    return Response(
        {
            "rating": ProductRatingSerializer(rating_obj).data,
            "rating_avg": stats['rating_avg'] or 0,
            "rating_count": stats['rating_count'] or 0,
        },
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


def rate_product_missing_trailing_slash(request, product_id):
    # Некорректный URL (без завершающего /) должен давать клиентскую ошибку, а не 500.
    return JsonResponse({"detail": "Not found."}, status=404)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    method = data['method']
    identifier = data['identifier'].strip()
    password = data['password']
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()

    User = get_user_model()

    if method == 'email':
        if User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).exists():
            return Response({"detail": "Пользователь с таким email уже существует."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=identifier, email=identifier, password=password)
        profile = Profile.objects.create(user=user)
    else:
        if User.objects.filter(username=identifier).exists() or Profile.objects.filter(phone=identifier).exists():
            return Response({"detail": "Пользователь с таким телефоном уже существует."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=identifier, password=password)
        profile = Profile.objects.create(user=user, phone=identifier)

    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if first_name or last_name:
        user.save(update_fields=['first_name', 'last_name'])

    profile.first_name = first_name
    profile.last_name = last_name
    profile.save(update_fields=['first_name', 'last_name'])

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_user(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    identifier = serializer.validated_data['identifier'].strip()
    password = serializer.validated_data['password']

    User = get_user_model()
    user = (
        User.objects.filter(username__iexact=identifier).first()
        or User.objects.filter(email__iexact=identifier).first()
        or User.objects.filter(profile__phone=identifier).first()
    )

    if not user:
        return Response({"detail": "Пользователь не найден."}, status=status.HTTP_400_BAD_REQUEST)

    auth_user = authenticate(username=user.username, password=password)
    if not auth_user:
        return Response({"detail": "Неверный пароль."}, status=status.HTTP_400_BAD_REQUEST)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key}, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def send_email_code(request):
    serializer = EmailCodeSendSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    _purge_expired_codes()
    email = serializer.validated_data['email'].strip().lower()
    purpose = serializer.validated_data['purpose']

    User = get_user_model()
    user_exists = User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists()
    if purpose == 'register' and user_exists:
        return Response({"detail": "Пользователь с таким email уже существует."}, status=status.HTTP_400_BAD_REQUEST)
    if purpose in ('login', 'reset') and not user_exists:
        return Response({"detail": "Пользователь с таким email не найден."}, status=status.HTTP_400_BAD_REQUEST)

    EmailVerificationCode.objects.filter(email__iexact=email, purpose=purpose, is_used=False).update(is_used=True)

    code = _generate_email_code()
    EmailVerificationCode.objects.create(email=email, code=code, purpose=purpose)

    send_mail(
        subject="Код подтверждения Kokossimo",
        message=f"Ваш код подтверждения: {code}. Он действует {_email_code_ttl()} минут.",
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        recipient_list=[email],
        fail_silently=False,
    )

    return Response({"detail": "Код отправлен на почту."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def verify_email_code(request):
    serializer = EmailCodeVerifySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    _purge_expired_codes()
    email = serializer.validated_data['email'].strip().lower()
    code = serializer.validated_data['code']
    purpose = serializer.validated_data['purpose']

    cutoff = timezone.now() - timedelta(minutes=_email_code_ttl())
    record = (
        EmailVerificationCode.objects.filter(
            email__iexact=email,
            purpose=purpose,
            is_used=False,
            created_at__gte=cutoff,
        )
        .order_by('-created_at')
        .first()
    )

    if not record or record.code != code:
        return Response({"detail": "Неверный или просроченный код."}, status=status.HTTP_400_BAD_REQUEST)

    record.is_used = True
    record.save(update_fields=['is_used'])

    User = get_user_model()
    if purpose == 'login':
        user = User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).first()
        if not user:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_200_OK)

    if purpose == 'reset':
        password = serializer.validated_data.get('password')
        if not password:
            return Response({"detail": "Новый пароль обязателен."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).first()
        if not user:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=['password'])
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "detail": "Пароль обновлен."}, status=status.HTTP_200_OK)

    password = serializer.validated_data.get('password')
    if not password:
        return Response({"detail": "Пароль обязателен для регистрации."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists():
        return Response({"detail": "Пользователь с таким email уже существует."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email, email=email, password=password)
    profile = Profile.objects.create(user=user)

    first_name = serializer.validated_data.get('first_name', '').strip()
    last_name = serializer.validated_data.get('last_name', '').strip()
    if first_name:
        user.first_name = first_name
        profile.first_name = first_name
    if last_name:
        user.last_name = last_name
        profile.last_name = last_name
    if first_name or last_name:
        user.save(update_fields=['first_name', 'last_name'])
        profile.save(update_fields=['first_name', 'last_name'])

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout_user(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"detail": "Вы вышли из аккаунта."}, status=status.HTTP_200_OK)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    profile = getattr(user, 'profile', None)
    return Response({
        "first_name": profile.first_name if profile else user.first_name,
        "last_name": profile.last_name if profile else user.last_name,
        "email": user.email,
        "phone": profile.phone if profile else "",
        "city": profile.city if profile else "",
        "street": profile.street if profile else "",
        "house": profile.house if profile else "",
        "apartment": profile.apartment if profile else "",
        "postal_code": profile.postal_code if profile else "",
    })


@api_view(['PATCH'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_profile(request):
    serializer = ProfileUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    profile = getattr(user, 'profile', None)
    if not profile:
        profile = Profile.objects.create(user=user)

    data = serializer.validated_data
    if 'first_name' in data:
        user.first_name = data['first_name']
        profile.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
        profile.last_name = data['last_name']
    if 'email' in data:
        user.email = data['email']
    if 'phone' in data:
        profile.phone = data['phone']
    if 'city' in data:
        profile.city = data['city']
    if 'street' in data:
        profile.street = data['street']
    if 'house' in data:
        profile.house = data['house']
    if 'apartment' in data:
        profile.apartment = data['apartment']
    if 'postal_code' in data:
        profile.postal_code = data['postal_code']

    user.save()
    profile.save()

    return Response({
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": user.email,
        "phone": profile.phone,
        "city": profile.city,
        "street": profile.street,
        "house": profile.house,
        "apartment": profile.apartment,
        "postal_code": profile.postal_code,
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def create_order(request):
    serializer = OrderCreateSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    order = serializer.save()
    return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def list_orders(request):
    orders = Order.objects.filter(user=request.user).prefetch_related('items__product').order_by('-created_at')
    return Response(OrderSerializer(orders, many=True, context={'request': request}).data)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def order_detail(request, order_id):
    try:
        order = Order.objects.prefetch_related('items__product').get(id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({"detail": "Заказ не найден."}, status=status.HTTP_404_NOT_FOUND)
    return Response(OrderSerializer(order, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def product_image_proxy(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    if not product.external_image_url:
        return Response({"detail": "Изображение не найдено."}, status=status.HTTP_404_NOT_FOUND)

    def _image_response(binary_payload, mime_type):
        response = HttpResponse(binary_payload, content_type=mime_type)
        response["Cache-Control"] = "public, max-age=3600"
        return response

    def _extract_image_url_candidates(row):
        candidates = []
        images_data = (row or {}).get("images") or {}

        if isinstance(images_data, list):
            for image_item in images_data:
                item = image_item or {}
                meta = item.get("meta") or {}
                miniature = item.get("miniature") or {}
                candidates.extend(
                    [
                        meta.get("downloadHref") or "",
                        miniature.get("downloadHref") or "",
                        meta.get("href") or "",
                    ]
                )
        else:
            rows = images_data.get("rows") or []
            for image_row in rows:
                row_item = image_row or {}
                meta = row_item.get("meta") or {}
                miniature = row_item.get("miniature") or {}
                candidates.extend(
                    [
                        meta.get("downloadHref") or "",
                        miniature.get("downloadHref") or "",
                        meta.get("href") or "",
                    ]
                )

            images_meta = images_data.get("meta") or {}
            if images_meta:
                try:
                    fetched_rows = client.get_images_rows_from_meta(images_meta, limit=5)
                except Exception:
                    fetched_rows = []
                for fetched in fetched_rows:
                    meta = (fetched or {}).get("meta") or {}
                    miniature = (fetched or {}).get("miniature") or {}
                    candidates.extend(
                        [
                            meta.get("downloadHref") or "",
                            miniature.get("downloadHref") or "",
                            meta.get("href") or "",
                        ]
                    )

        uniq = []
        seen = set()
        for url in candidates:
            if not url:
                continue
            if url in seen:
                continue
            seen.add(url)
            uniq.append(url)
        return uniq

    try:
        client = MoySkladClient()
    except MoySkladConfigError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def _refresh_image_url_and_download(current_url, reason_detail=""):
        if not product.moysklad_id:
            return None
        try:
            row = client.get_assortment_item(product.moysklad_id)
            candidates = _extract_image_url_candidates(row)
            if not candidates:
                fresh_image_url = _extract_image_url(
                    row,
                    client,
                    # Для восстановления ссылки всегда пробуем дочитать images.meta->rows.
                    allow_meta_fetch=True,
                )
                if fresh_image_url:
                    candidates = [fresh_image_url]
            for candidate_url in candidates:
                try:
                    payload, content_type = client.download_binary(candidate_url)
                except MoySkladError:
                    continue
                if candidate_url != current_url:
                    product.external_image_url = candidate_url
                    product.save(update_fields=["external_image_url"])
                return _image_response(payload, content_type)
            return None
        except (MoySkladError, MoySkladConfigError):
            return None

    # Устаревшие записи могли сохранить meta.href вместо downloadHref.
    # Такие URL часто не являются бинарным download endpoint.
    if "download" not in (product.external_image_url or "").lower():
        refreshed = _refresh_image_url_and_download(product.external_image_url, "non-download URL")
        if refreshed is not None:
            return refreshed

    try:
        payload, content_type = client.download_binary(product.external_image_url)
        return _image_response(payload, content_type)
    except MoySkladError as exc:
        detail = str(exc)
        # downloadHref у МойСклад может стать невалидным (например, после ротации/истечения),
        # либо ссылкой окажется не "скачиваемый" endpoint (HTTP 415).
        # Пытаемся один раз обновить ссылку из актуального assortment и повторить скачивание.
        can_refresh_url = (
            bool(product.moysklad_id)
            and any(code in detail for code in ("HTTP 403", "HTTP 404", "HTTP 410", "HTTP 415"))
        )
        if can_refresh_url:
            refreshed = _refresh_image_url_and_download(product.external_image_url, detail)
            if refreshed is not None:
                return refreshed

        if "HTTP 404" in detail:
            return Response({"detail": "Изображение не найдено."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": detail}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def moysklad_status(request):
    try:
        client = MoySkladClient()
        result = client.ping()
    except MoySkladConfigError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except MoySkladError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    rows_count = len(result.get('rows', []))
    return Response(
        {
            "ok": True,
            "rows_count": rows_count,
            "offset": result.get("meta", {}).get("offset", 0),
            "limit": result.get("meta", {}).get("limit", 1),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def moysklad_assortment(request):
    try:
        limit = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
    except ValueError:
        return Response(
            {"detail": "Параметры limit и offset должны быть целыми числами."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    search = request.query_params.get('search', '')

    try:
        client = MoySkladClient()
        result = client.get_assortment(limit=limit, offset=offset, search=search)
    except MoySkladConfigError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except MoySkladError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    rows = result.get('rows', [])
    normalized_rows = [
        {
            "id": row.get("id"),
            "name": row.get("name"),
            "code": row.get("code"),
            "article": row.get("article"),
            "sale_prices": row.get("salePrices", []),
            "stock": row.get("stock", 0),
            "path_name": row.get("pathName", ""),
        }
        for row in rows
    ]

    return Response(
        {
            "count": result.get("meta", {}).get("size", len(normalized_rows)),
            "offset": result.get("meta", {}).get("offset", offset),
            "limit": result.get("meta", {}).get("limit", limit),
            "rows": normalized_rows,
        },
        status=status.HTTP_200_OK,
    )