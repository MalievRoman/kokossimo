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
from django.db.models import Q, Avg, Count, Min, Max, Prefetch
from django.db import transaction
from decimal import Decimal, InvalidOperation
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect
import base64
import logging
import uuid
from decimal import ROUND_HALF_UP

from yookassa import Configuration, Payment

from .models import Product, Category, Profile, Order, EmailVerificationCode, ProductRating, ProductSubcategory, Cart, CartItem, FavoriteList, FavoriteItem

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
    CartSyncSerializer,
    FavoriteSyncSerializer,
)


def _email_code_ttl():
    return int(getattr(settings, 'EMAIL_CODE_TTL_MINUTES', 10))


def _generate_email_code():
    return f"{secrets.randbelow(10**6):06d}"


def _purge_expired_codes():
    cutoff = timezone.now() - timedelta(minutes=_email_code_ttl())
    EmailVerificationCode.objects.filter(created_at__lt=cutoff).delete()


def _yookassa_enabled():
    return bool(getattr(settings, "YOOKASSA_SHOP_ID", "")) and bool(getattr(settings, "YOOKASSA_SECRET_KEY", ""))


def _yookassa_amount(value):
    amount = Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{amount:.2f}"


def _yookassa_return_url(request, order):
    configured = (getattr(settings, "YOOKASSA_RETURN_URL", "") or "").strip()
    if configured:
        return configured
    return request.build_absolute_uri(f"/checkout/success?order={order.id}")


def _create_yookassa_payment(order, request):
    Configuration.account_id = settings.YOOKASSA_SHOP_ID
    Configuration.secret_key = settings.YOOKASSA_SECRET_KEY

    payment_request = {
        "amount": {
            "value": _yookassa_amount(order.total_price),
            "currency": "RUB",
        },
        "confirmation": {
            "type": "redirect",
            "return_url": _yookassa_return_url(request, order),
        },
        "capture": True,
        "description": f"Оплата заказа #{order.id}",
        "metadata": {
            "order_id": str(order.id),
            "user_id": str(order.user_id or ""),
        },
    }

    payment = Payment.create(payment_request, str(uuid.uuid4()))
    confirmation_url = ""
    confirmation = getattr(payment, "confirmation", None)
    if confirmation is not None:
        confirmation_url = getattr(confirmation, "confirmation_url", "") or ""

    order.payment_provider = "yookassa"
    order.payment_id = str(getattr(payment, "id", "") or "")
    order.payment_status = str(getattr(payment, "status", "") or "pending")
    order.save(update_fields=["payment_provider", "payment_id", "payment_status"])

    return payment, confirmation_url


def _cart_item_image_url(product, request):
    if not product:
        return None
    if product.image:
        if request:
            return request.build_absolute_uri(product.image.url)
        return f"{settings.MEDIA_URL}{product.image}"
    if getattr(product, "external_image_url", ""):
        if request:
            return request.build_absolute_uri(f"/api/products/{product.id}/image/")
        return f"/api/products/{product.id}/image/"
    return None


def _cart_item_public_payload(item, request):
    if item.product_id:
        product = item.product
        return {
            "id": product.id,
            "name": product.name,
            "price": str(product.price),
            "discount": int(product.discount or 0),
            "image": _cart_item_image_url(product, request),
            "quantity": int(item.quantity or 0),
            "stock": int(product.stock or 0),
            "is_gift_certificate": False,
        }

    gift_title = (item.title or "Подарочный сертификат").strip() or "Подарочный сертификат"
    gift_id = (item.external_id or "").strip() or f"gift-{int(item.unit_price)}"
    return {
        "id": gift_id,
        "name": gift_title,
        "price": str(item.unit_price),
        "discount": 0,
        "image": None,
        "quantity": int(item.quantity or 0),
        "stock": None,
        "is_gift_certificate": True,
    }


def _cart_guest_item_is_product(item):
    if item.get("is_gift_certificate") is True:
        return False
    raw_id = item.get("id")
    if isinstance(raw_id, int):
        return True
    if isinstance(raw_id, str) and raw_id.strip().isdigit():
        return True
    return False


def _cart_guest_item_product_id(item):
    raw_id = item.get("id")
    if isinstance(raw_id, int):
        return raw_id
    if isinstance(raw_id, str) and raw_id.strip().isdigit():
        return int(raw_id.strip())
    return None


def _cart_guest_item_gift_external_id(item):
    raw_id = str(item.get("id") or "").strip()
    if raw_id:
        return raw_id[:120]
    fallback_name = str(item.get("name") or "Подарочный сертификат").strip()
    fallback_price = str(item.get("price") or "0").strip()
    return f"gift-{fallback_price}-{fallback_name}"[:120]


@transaction.atomic
def _upsert_user_cart(user, incoming_items, merge=False):
    cart, _ = Cart.objects.select_for_update().get_or_create(user=user)
    existing_items = list(cart.items.select_related("product"))

    normalized = {}

    if merge:
        for row in existing_items:
            if row.product_id:
                key = f"p:{row.product_id}"
                normalized[key] = {
                    "product_id": row.product_id,
                    "quantity": int(row.quantity or 0),
                }
            else:
                gift_key = f"g:{row.external_id}"
                normalized[gift_key] = {
                    "external_id": row.external_id,
                    "title": row.title,
                    "unit_price": row.unit_price,
                    "quantity": int(row.quantity or 0),
                    "is_gift_certificate": True,
                }

    for item in incoming_items:
        qty = int(item.get("quantity") or 0)
        if qty <= 0:
            continue

        if _cart_guest_item_is_product(item):
            product_id = _cart_guest_item_product_id(item)
            if not product_id:
                continue
            key = f"p:{product_id}"
            if key not in normalized:
                normalized[key] = {"product_id": product_id, "quantity": 0}
            normalized[key]["quantity"] += qty
            continue

        try:
            unit_price = Decimal(str(item.get("price") or "0"))
        except (InvalidOperation, TypeError, ValueError):
            unit_price = Decimal("0")
        title = str(item.get("name") or "Подарочный сертификат").strip() or "Подарочный сертификат"
        external_id = _cart_guest_item_gift_external_id(item)
        key = f"g:{external_id}"
        if key not in normalized:
            normalized[key] = {
                "external_id": external_id,
                "title": title[:255],
                "unit_price": unit_price,
                "quantity": 0,
                "is_gift_certificate": True,
            }
        normalized[key]["quantity"] += qty

    product_ids = [entry["product_id"] for entry in normalized.values() if entry.get("product_id")]
    products = Product.objects.in_bulk(product_ids)

    cart.items.all().delete()
    to_create = []

    for entry in normalized.values():
        product_id = entry.get("product_id")
        if product_id:
            product = products.get(product_id)
            if not product:
                continue
            stock = max(0, int(product.stock or 0))
            if stock <= 0:
                continue
            quantity = min(int(entry.get("quantity") or 0), stock)
            if quantity <= 0:
                continue
            to_create.append(
                CartItem(
                    cart=cart,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price,
                    discount=int(product.discount or 0),
                    title=product.name[:255],
                    is_gift_certificate=False,
                    external_id="",
                )
            )
            continue

        quantity = int(entry.get("quantity") or 0)
        if quantity <= 0:
            continue
        to_create.append(
            CartItem(
                cart=cart,
                product=None,
                quantity=quantity,
                unit_price=entry.get("unit_price") or Decimal("0"),
                discount=0,
                title=(entry.get("title") or "Подарочный сертификат")[:255],
                is_gift_certificate=True,
                external_id=(entry.get("external_id") or "")[:120],
            )
        )

    if to_create:
        CartItem.objects.bulk_create(to_create)


@transaction.atomic
def _get_user_cart_payload(user, request):
    cart, _ = Cart.objects.select_for_update().get_or_create(user=user)
    items = list(cart.items.select_related("product"))
    touched = False

    # Корректируем устаревшие строки корзины (товар удален / остаток уменьшился).
    for row in items:
        if not row.product_id:
            continue
        stock = max(0, int(row.product.stock or 0))
        if stock <= 0:
            row.delete()
            touched = True
            continue
        if int(row.quantity or 0) > stock:
            row.quantity = stock
            row.save(update_fields=["quantity", "updated_at"])
            touched = True

    if touched:
        items = list(cart.items.select_related("product"))

    return {
        "user_id": user.id,
        "items": [_cart_item_public_payload(row, request) for row in items],
    }


def _favorite_item_public_payload(product, request):
    return {
        "id": product.id,
        "name": product.name,
        "price": str(product.price),
        "image": _cart_item_image_url(product, request),
        "description": product.description,
        "is_new": bool(product.is_new),
        "discount": int(product.discount or 0),
        "is_gift_certificate": False,
    }


@transaction.atomic
def _upsert_user_favorites(user, incoming_product_ids, merge=False):
    favorite_list, _ = FavoriteList.objects.select_for_update().get_or_create(user=user)
    incoming_ids = {
        int(product_id)
        for product_id in incoming_product_ids
        if isinstance(product_id, int) and int(product_id) > 0
    }

    if merge:
        existing_ids = set(favorite_list.items.values_list("product_id", flat=True))
        target_ids = existing_ids | incoming_ids
    else:
        target_ids = incoming_ids

    valid_products = Product.objects.filter(id__in=target_ids).values_list("id", flat=True)
    valid_ids = set(valid_products)

    favorite_list.items.exclude(product_id__in=valid_ids).delete()

    existing_ids = set(favorite_list.items.values_list("product_id", flat=True))
    missing_ids = valid_ids - existing_ids
    if missing_ids:
        FavoriteItem.objects.bulk_create(
            [
                FavoriteItem(favorite_list=favorite_list, product_id=product_id)
                for product_id in missing_ids
            ]
        )


def _get_user_favorites_payload(user, request):
    favorite_list, _ = FavoriteList.objects.get_or_create(user=user)
    items = (
        favorite_list.items
        .select_related("product")
        .order_by("-created_at")
    )
    products = [item.product for item in items if item.product_id]
    return {
        "user_id": user.id,
        "items": [_favorite_item_public_payload(product, request) for product in products],
    }


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

    def _with_user_rating_prefetch(self, queryset):
        if not self.request.user.is_authenticated:
            return queryset
        user_ratings_qs = ProductRating.objects.filter(user_id=self.request.user.id).only(
            "id",
            "product_id",
            "rating",
            "user_id",
        )
        return queryset.prefetch_related(
            Prefetch("ratings", queryset=user_ratings_qs, to_attr="current_user_ratings")
        )

    def get_queryset(self):
        subcategory_codes = self.request.query_params.getlist('subcategory')
        parent_codes = self.request.query_params.getlist('parent')
        price_min = self.request.query_params.get("price_min")
        price_max = self.request.query_params.get("price_max")
        search_q = (self.request.query_params.get("q") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "").strip()
        is_new = self.request.query_params.get('is_new', None)
        is_bestseller = self.request.query_params.get('is_bestseller', None)
        in_stock = self.request.query_params.get('in_stock', None)

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
            if in_stock == 'true':
                queryset = queryset.filter(stock__gt=0)

            # Важно: если выбраны подкатегории, они должны быть приоритетнее родителя.
            # Иначе при одновременной передаче parent+subcategory (как в UI) получаем весь parent.
            if subcategory_codes:
                queryset = queryset.filter(product_subcategory__isnull=False, product_subcategory__code__in=subcategory_codes)
            elif parent_codes:
                queryset = queryset.filter(product_subcategory__isnull=False, product_subcategory__parent_code__in=parent_codes)
            if search_q:
                queryset = queryset.filter(
                    Q(name__icontains=search_q) | Q(description__icontains=search_q)
                )
            queryset = _apply_price_filters(queryset)
            queryset = _apply_ordering(queryset)
            queryset = self._with_user_rating_prefetch(queryset)
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
        if in_stock == 'true':
            queryset = queryset.filter(stock__gt=0)

        if category_slugs:
            queryset = queryset.filter(category__slug__in=category_slugs)

        # Важно: если выбраны подкатегории, они должны быть приоритетнее родителя.
        if subcategory_codes:
            queryset = queryset.filter(product_subcategory__isnull=False, product_subcategory__code__in=subcategory_codes)
        elif parent_codes:
            queryset = queryset.filter(product_subcategory__isnull=False, product_subcategory__parent_code__in=parent_codes)

        if search_q:
            queryset = queryset.filter(
                Q(name__icontains=search_q) | Q(description__icontains=search_q)
            )

        queryset = _apply_price_filters(queryset)
        queryset = _apply_ordering(queryset)
        queryset = self._with_user_rating_prefetch(queryset)
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


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def rate_product_missing_trailing_slash(request, product_id):
    """
    Некорректный URL без завершающего слэша.
    Должен возвращать клиентскую ошибку (404), а не 500/403 от CSRF.
    """
    return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)


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
    now = timezone.now()
    ttl_minutes = _email_code_ttl()
    cutoff = now - timedelta(minutes=ttl_minutes)
    email = serializer.validated_data['email'].strip().lower()
    purpose = serializer.validated_data['purpose']

    User = get_user_model()
    user_exists = User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists()
    if purpose == 'register' and user_exists:
        return Response({"detail": "Пользователь с таким email уже существует."}, status=status.HTTP_400_BAD_REQUEST)
    if purpose in ('login', 'reset') and not user_exists:
        return Response({"detail": "Пользователь с таким email не найден."}, status=status.HTTP_400_BAD_REQUEST)

    existing_code = (
        EmailVerificationCode.objects.filter(
            email__iexact=email,
            purpose=purpose,
            is_used=False,
            created_at__gte=cutoff,
        )
        .order_by('-created_at')
        .first()
    )
    if existing_code:
        expires_at = existing_code.created_at + timedelta(minutes=ttl_minutes)
        seconds_left = max(int((expires_at - now).total_seconds()), 0)
        return Response(
            {
                "detail": "Код уже отправлен на почту. Используйте ранее полученный код.",
                "seconds_left": seconds_left,
            },
            status=status.HTTP_200_OK,
        )

    EmailVerificationCode.objects.filter(email__iexact=email, purpose=purpose, is_used=False).update(is_used=True)

    code = _generate_email_code()
    EmailVerificationCode.objects.create(email=email, code=code, purpose=purpose)

    send_mail(
        subject="Код подтверждения Kokossimo",
        message=f"Ваш код подтверждения: {code}. Он действует {ttl_minutes} минут.",
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
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
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
        "birth_date": profile.birth_date if profile else None,
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
    if 'birth_date' in data:
        profile.birth_date = data['birth_date']
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
        "birth_date": profile.birth_date,
        "city": profile.city,
        "street": profile.street,
        "house": profile.house,
        "apartment": profile.apartment,
        "postal_code": profile.postal_code,
    })


@api_view(['GET', 'PUT'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def user_cart(request):
    if request.method == 'GET':
        return Response(_get_user_cart_payload(request.user, request), status=status.HTTP_200_OK)

    serializer = CartSyncSerializer(data=request.data or {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    _upsert_user_cart(
        request.user,
        serializer.validated_data.get("items", []),
        merge=False,
    )
    return Response(_get_user_cart_payload(request.user, request), status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def merge_user_cart(request):
    serializer = CartSyncSerializer(data=request.data or {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    _upsert_user_cart(
        request.user,
        serializer.validated_data.get("items", []),
        merge=True,
    )
    return Response(_get_user_cart_payload(request.user, request), status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def user_favorites(request):
    if request.method == 'GET':
        return Response(_get_user_favorites_payload(request.user, request), status=status.HTTP_200_OK)

    serializer = FavoriteSyncSerializer(data=request.data or {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    _upsert_user_favorites(
        request.user,
        serializer.validated_data.get("items", []),
        merge=False,
    )
    return Response(_get_user_favorites_payload(request.user, request), status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def merge_user_favorites(request):
    serializer = FavoriteSyncSerializer(data=request.data or {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    _upsert_user_favorites(
        request.user,
        serializer.validated_data.get("items", []),
        merge=True,
    )
    return Response(_get_user_favorites_payload(request.user, request), status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def create_order(request):
    serializer = OrderCreateSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    order = serializer.save()
    return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def create_yookassa_payment(request):
    if not _yookassa_enabled():
        return Response({"detail": "ЮKassa не настроена на сервере."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    order_id = request.data.get("order_id")
    if not order_id:
        return Response({"detail": "Поле order_id обязательно."}, status=status.HTTP_400_BAD_REQUEST)

    order = get_object_or_404(Order, id=order_id, user=request.user)
    if order.payment_method != "card_online":
        return Response({"detail": "Для заказа не выбрана онлайн-оплата."}, status=status.HTTP_400_BAD_REQUEST)

    # Уже оплачен: повторный checkout не создаем.
    if order.payment_status == "succeeded" or order.status == "paid":
        return Response(
            {
                "detail": "Заказ уже оплачен.",
                "order_id": order.id,
                "payment_id": order.payment_id,
                "payment_status": order.payment_status,
            },
            status=status.HTTP_200_OK,
        )

    try:
        payment, confirmation_url = _create_yookassa_payment(order, request)
    except Exception as exc:
        logger.exception("Failed to create YooKassa payment for order %s", order.id)
        return Response({"detail": f"Не удалось создать платеж: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)

    return Response(
        {
            "order_id": order.id,
            "payment_id": str(getattr(payment, "id", "") or ""),
            "payment_status": str(getattr(payment, "status", "") or ""),
            "confirmation_url": confirmation_url,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def yookassa_webhook(request):
    payload = request.data or {}
    event = payload.get("event")
    payment_obj = payload.get("object") or {}
    payment_id = str(payment_obj.get("id") or "")
    payment_status = str(payment_obj.get("status") or "")
    metadata = payment_obj.get("metadata") or {}
    order_id = metadata.get("order_id")

    if not payment_id:
        return Response({"detail": "Missing payment id."}, status=status.HTTP_400_BAD_REQUEST)

    order = None
    if order_id:
        order = Order.objects.filter(id=order_id).first()
    if order is None:
        order = Order.objects.filter(payment_id=payment_id).first()
    if order is None:
        return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

    amount_obj = payment_obj.get("amount") or {}
    amount_value = amount_obj.get("value")
    try:
        paid_amount = Decimal(str(amount_value)) if amount_value is not None else None
    except (InvalidOperation, TypeError):
        paid_amount = None
    if paid_amount is not None and paid_amount != Decimal(order.total_price):
        logger.warning(
            "YooKassa amount mismatch for order %s: expected=%s got=%s",
            order.id,
            order.total_price,
            paid_amount,
        )
        return Response({"detail": "Amount mismatch."}, status=status.HTTP_400_BAD_REQUEST)

    updates = {
        "payment_provider": "yookassa",
        "payment_id": payment_id,
        "payment_status": payment_status,
    }

    if payment_status == "succeeded":
        updates["status"] = "paid"
        if not order.paid_at:
            updates["paid_at"] = timezone.now()
    elif payment_status == "canceled":
        # Бизнес-логика может отличаться; для стейджа помечаем как отмененный.
        updates["status"] = "cancelled"

    for field, value in updates.items():
        setattr(order, field, value)
    order.save(update_fields=list(updates.keys()))

    return Response({"detail": "ok", "event": event}, status=status.HTTP_200_OK)


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
    if product.image:
        return HttpResponseRedirect(product.image.url)
    if getattr(product, "external_image_url", ""):
        return HttpResponseRedirect(product.external_image_url)
    return _placeholder_or_debug(request, "no_image_available")


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