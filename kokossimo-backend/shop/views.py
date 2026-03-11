from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action
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
import time
from django.db.models import Q, Avg, Count, Min, Max
from decimal import Decimal, InvalidOperation
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
import base64
import logging

from .models import Product, Category, Profile, Order, EmailVerificationCode, ProductRating, ProductSubcategory

logger = logging.getLogger(__name__)
# Миниатюра 1×1 прозрачный GIF — чтобы при ошибках отдавать изображение, а не JSON,
# иначе браузер блокирует ответ (ERR_BLOCKED_BY_ORB) при запросе через <img src="...">.
_PLACEHOLDER_IMAGE_GIF = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")


def _placeholder_or_debug(request, reason):
    """Если в запросе ?debug=1 — вернуть JSON с причиной, иначе плейсхолдер 1×1 GIF."""
    if request.GET.get("debug"):
        return JsonResponse(
            {"status": "placeholder", "reason": reason},
            json_dumps_params={"ensure_ascii": False},
        )
    return _placeholder_image_response(reason)


def _placeholder_image_response(reason=""):
    """Ответ с прозрачным 1×1 GIF для обхода ORB при ошибках эндпоинта изображений."""
    resp = HttpResponse(_PLACEHOLDER_IMAGE_GIF, content_type="image/gif")
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Access-Control-Allow-Origin"] = "*"
    if reason:
        resp["X-Image-Proxy-Reason"] = reason
    return resp
from .moysklad import MoySkladClient, MoySkladError, MoySkladConfigError
from .moysklad_sync import _extract_image_url
from .serializers import (
    ProductSerializer,
    CategorySerializer,
    ProductSubcategorySerializer,
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


class ProductSubcategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Список подкатегорий и дерево категорий для фильтра каталога."""
    queryset = ProductSubcategory.objects.all().order_by("code")
    serializer_class = ProductSubcategorySerializer

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """Дерево: большие категории (1–4) с вложенными подкатегориями (1.1, 1.2, …)."""
        parents = ProductSubcategory.objects.filter(parent_code="").order_by("code")
        children_map = {}
        for sub in ProductSubcategory.objects.exclude(parent_code="").order_by("code"):
            children_map.setdefault(sub.parent_code, []).append({
                "id": sub.id,
                "code": sub.code,
                "name": sub.name,
                "parent_code": sub.parent_code,
            })
        result = []
        for p in parents:
            result.append({
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "parent_code": p.parent_code or "",
                "children": children_map.get(p.code, []),
            })
        return Response(result)


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
        subcategory_codes = self.request.query_params.getlist('subcategory')
        parent_codes = self.request.query_params.getlist('parent')
        price_min = self.request.query_params.get("price_min")
        price_max = self.request.query_params.get("price_max")
        ordering = (self.request.query_params.get("ordering") or "").strip()
        is_new = self.request.query_params.get('is_new', None)
        is_bestseller = self.request.query_params.get('is_bestseller', None)

        def _parse_decimal(value):
            if value is None:
                return None
            s = str(value).strip()
            if not s:
                return None
            try:
                return Decimal(s)
            except (InvalidOperation, ValueError):
                return None

        def _apply_price_filters(qs):
            min_val = _parse_decimal(price_min)
            max_val = _parse_decimal(price_max)
            if min_val is not None:
                qs = qs.filter(price__gte=min_val)
            if max_val is not None:
                qs = qs.filter(price__lte=max_val)
            return qs

        def _apply_ordering(qs):
            if not ordering:
                return qs
            allowed = {"price", "created_at", "id", "is_new", "is_bestseller"}
            parts = [p.strip() for p in ordering.split(",") if p.strip()]
            fields = []
            for part in parts:
                desc = part.startswith("-")
                name = part[1:] if desc else part
                if name not in allowed:
                    continue
                fields.append(f"-{name}" if desc else name)
            return qs.order_by(*fields) if fields else qs

        if getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            queryset = Product.objects.filter(
                moysklad_id__isnull=False,
                category__slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo"),
            ).select_related('category', 'product_subcategory').annotate(
                rating_avg=Avg('ratings__rating'),
                rating_count=Count('ratings')
            ).order_by('-created_at', '-id')

            # В режиме МойСклад также должны работать фильтры "новинки/бестселлеры"
            if is_new == 'true':
                queryset = queryset.filter(is_new=True)
            if is_bestseller == 'true':
                queryset = queryset.filter(is_bestseller=True)

            if subcategory_codes or parent_codes:
                q = Q(product_subcategory__isnull=False)
                if parent_codes and subcategory_codes:
                    q &= (Q(product_subcategory__parent_code__in=parent_codes) | Q(product_subcategory__code__in=subcategory_codes))
                elif parent_codes:
                    q &= Q(product_subcategory__parent_code__in=parent_codes)
                elif subcategory_codes:
                    q &= Q(product_subcategory__code__in=subcategory_codes)
                queryset = queryset.filter(q)
            queryset = _apply_price_filters(queryset)
            queryset = _apply_ordering(queryset)
            return queryset

        # Фильтрация товаров через параметры URL
        # Пример: /api/products/?is_new=true&category=face&category=body&subcategory=1.1
        queryset = Product.objects.select_related('category', 'product_subcategory').annotate(
            rating_avg=Avg('ratings__rating'),
            rating_count=Count('ratings')
        ).order_by('-created_at', '-id')
        
        category_slugs = self.request.query_params.getlist('category')

        if is_new == 'true':
            queryset = queryset.filter(is_new=True)
        
        if is_bestseller == 'true':
            queryset = queryset.filter(is_bestseller=True)

        if category_slugs:
            queryset = queryset.filter(category__slug__in=category_slugs)

        if subcategory_codes or parent_codes:
            q = Q(product_subcategory__isnull=False)
            if parent_codes and subcategory_codes:
                q &= (Q(product_subcategory__parent_code__in=parent_codes) | Q(product_subcategory__code__in=subcategory_codes))
            elif parent_codes:
                q &= Q(product_subcategory__parent_code__in=parent_codes)
            elif subcategory_codes:
                q &= Q(product_subcategory__code__in=subcategory_codes)
            queryset = queryset.filter(q)

        queryset = _apply_price_filters(queryset)
        queryset = _apply_ordering(queryset)
        return queryset

    @action(detail=False, methods=["get"], url_path="price-range")
    def price_range(self, request):
        """
        Реальный диапазон цен для текущих фильтров.
        ВАЖНО: фронт вызывает этот эндпоинт без price_min/price_max,
        чтобы подсказки "от/до" всегда показывали минимальную/максимальную цену товаров в выборке.
        """
        qs = self.get_queryset()
        agg = qs.aggregate(min_price=Min("price"), max_price=Max("price"))
        min_price = agg.get("min_price")
        max_price = agg.get("max_price")
        return Response(
            {
                "min_price": str(min_price) if min_price is not None else None,
                "max_price": str(max_price) if max_price is not None else None,
            }
        )

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
    try:
        return _product_image_proxy_impl(request, product_id)
    except Exception as e:
        reason = "error"
        msg = str(e).replace("\r", " ").replace("\n", " ").strip()[:80]
        if msg:
            reason = f"{reason}: {msg}"
        if request.GET.get("debug"):
            return JsonResponse(
                {"status": "placeholder", "reason": reason},
                json_dumps_params={"ensure_ascii": False},
            )
        return _placeholder_image_response(reason)


def _product_image_proxy_impl(request, product_id):
    product = Product.objects.filter(id=product_id).first()
    if not product:
        return _placeholder_or_debug(request, "product_not_found")
    if not product.external_image_url:
        return _placeholder_or_debug(request, "no_external_image_url")

    def _image_response(binary_payload, mime_type):
        response = HttpResponse(binary_payload, content_type=mime_type)
        response["Cache-Control"] = "public, max-age=3600"
        response["Access-Control-Allow-Origin"] = "*"
        return response

    def _extract_image_url_candidates(row):
        candidates = []
        images_data = (row or {}).get("images") or {}

        def add_original_then_miniature(item):
            meta = (item or {}).get("meta") or {}
            miniature = (item or {}).get("miniature") or {}
            original = meta.get("downloadHref")
            if not original and meta.get("href"):
                try:
                    full = client.get_image_by_href(meta.get("href"))
                    original = (full.get("meta") or {}).get("downloadHref")
                except Exception:
                    pass
            if original:
                candidates.append(original)
            if miniature.get("downloadHref"):
                candidates.append(miniature.get("downloadHref"))

        if isinstance(images_data, list):
            for image_item in images_data:
                add_original_then_miniature(image_item)
        else:
            rows = images_data.get("rows") or []
            for image_row in rows:
                add_original_then_miniature(image_row)

            images_meta = images_data.get("meta") or {}
            if images_meta:
                try:
                    fetched_rows = client.get_images_rows_from_meta(images_meta, limit=5)
                except Exception:
                    fetched_rows = []
                for fetched in fetched_rows:
                    add_original_then_miniature(fetched)

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

    def _row_to_image_candidates(row):
        """Кандидаты из строки ассортимента; для варианта — подгружаем товар по product.meta.href."""
        candidates = _extract_image_url_candidates(row)
        if not candidates and row.get("product"):
            product_meta = (row.get("product") or {}).get("meta") or {}
            product_href = product_meta.get("href")
            if product_href:
                try:
                    product_entity = client.get_entity_by_href(product_href, expand="images")
                    candidates = _extract_image_url_candidates(product_entity)
                except Exception:
                    pass
        if not candidates and row.get("meta", {}).get("href"):
            try:
                entity = client.get_entity_by_href(row["meta"]["href"], expand="images")
                candidates = _extract_image_url_candidates(entity)
            except Exception:
                pass
        return candidates

    try:
        client = MoySkladClient()
    except MoySkladConfigError:
        return _placeholder_or_debug(request, "moysklad_not_configured")

    def _refresh_image_url_and_download(current_url, reason_detail=""):
        if not product.moysklad_id:
            return None
        try:
            row = client.get_assortment_item(product.moysklad_id)
            candidates = _row_to_image_candidates(row)
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
    # Сначала пробуем взять актуальную ссылку из API (работает с истёкшими URL).
    if product.moysklad_id:
        refreshed = _refresh_image_url_and_download(
            product.external_image_url or "", "initial fetch"
        )
        if refreshed is not None:
            return refreshed
        # Refresh не вернул картинку — пробуем сохранённую ссылку
    last_error = None
    for attempt in range(2):  # две попытки на случай временного сбоя (таймаут, сеть)
        try:
            payload, content_type = client.download_binary(product.external_image_url)
            return _image_response(payload, content_type)
        except MoySkladError as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(0.5)
                continue
        break
    if last_error:
        detail = str(last_error)
        # При любой ошибке скачивания пробуем взять свежую ссылку из API (истёкшие/неверные URL).
        if product.moysklad_id:
            refreshed = _refresh_image_url_and_download(product.external_image_url, detail)
            if refreshed is not None:
                return refreshed
        reason = "download_failed"
        if detail:
            sanitized = (detail.replace("\r", " ").replace("\n", " ").strip())[:80]
            reason = f"{reason}: {sanitized}"
        return _placeholder_or_debug(request, reason)


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