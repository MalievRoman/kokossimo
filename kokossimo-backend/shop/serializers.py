from rest_framework import serializers
from django.db import transaction
from collections import defaultdict
from .models import Product, Category, Profile, Order, OrderItem, ProductRating, ProductSubcategory
from django.conf import settings

class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'image']
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return f"{settings.MEDIA_URL}{obj.image}"
        return None


class ProductSubcategorySerializer(serializers.ModelSerializer):
    """Для списка подкатегорий в фильтре каталога (код, название, родитель)."""
    class Meta:
        model = ProductSubcategory
        fields = ['id', 'code', 'name', 'parent_code']


class ProductSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    product_subcategory_code = serializers.SerializerMethodField()
    product_subcategory_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    rating_avg = serializers.FloatField(read_only=True)
    rating_count = serializers.IntegerField(read_only=True)
    user_rating = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'composition',
            'usage_instructions',
            'price',
            'stock',
            'is_in_stock',
            'image',
            'category_slug',
            'product_subcategory_code',
            'product_subcategory_name',
            'is_bestseller',
            'is_new',
            'discount',
            'rating_avg',
            'rating_count',
            'user_rating',
        ]
    
    def get_image(self, obj):
        if getattr(obj, "external_image_url", ""):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(f"/api/products/{obj.id}/image/")
            return f"/api/products/{obj.id}/image/"
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return f"{settings.MEDIA_URL}{obj.image}"
        return None

    def get_product_subcategory_code(self, obj):
        if obj.product_subcategory_id:
            return obj.product_subcategory.code
        return None

    def get_product_subcategory_name(self, obj):
        if obj.product_subcategory_id:
            return obj.product_subcategory.name
        return None

    def get_user_rating(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        rating = obj.ratings.filter(user=request.user).first()
        return rating.rating if rating else None

    def get_is_in_stock(self, obj):
        return int(getattr(obj, "stock", 0) or 0) > 0


class ProductRatingSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductRating
        fields = ['id', 'product', 'user_name', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'product', 'user_name', 'created_at']

    def get_user_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username


class ProductRatingCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True)


class RegisterSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['phone', 'email'])
    identifier = serializers.CharField()
    password = serializers.CharField(min_length=6)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField()


class EmailCodeSendSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=['login', 'register', 'reset'])


class EmailCodeVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    purpose = serializers.ChoiceField(choices=['login', 'register', 'reset'])
    password = serializers.CharField(required=False, allow_blank=False, min_length=6)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)


class ProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    birth_date = serializers.DateField(required=False, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=True)
    street = serializers.CharField(required=False, allow_blank=True)
    house = serializers.CharField(required=False, allow_blank=True)
    apartment = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True)


class CartItemSyncSerializer(serializers.Serializer):
    id = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    name = serializers.CharField(required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    discount = serializers.IntegerField(required=False, min_value=0, max_value=99)
    is_gift_certificate = serializers.BooleanField(required=False)


class CartSyncSerializer(serializers.Serializer):
    items = CartItemSyncSerializer(many=True)


class FavoriteSyncSerializer(serializers.Serializer):
    items = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=False)
    gift_certificate_amount = serializers.IntegerField(required=False, min_value=1)
    gift_certificate_name = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        if not attrs.get('product_id') and not attrs.get('gift_certificate_amount'):
            raise serializers.ValidationError("Укажите товар или сумму сертификата.")
        return attrs


class OrderCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200)
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=150)
    street = serializers.CharField(max_length=200)
    house = serializers.CharField(max_length=50)
    apartment = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    delivery_method = serializers.ChoiceField(choices=Order.DELIVERY_METHOD_CHOICES)
    payment_method = serializers.ChoiceField(choices=Order.PAYMENT_METHOD_CHOICES)
    items = OrderItemCreateSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Список товаров не может быть пустым.")
        product_ids = [item['product_id'] for item in items if item.get('product_id')]
        if product_ids:
            products = Product.objects.filter(id__in=product_ids)
            if products.count() != len(set(product_ids)):
                raise serializers.ValidationError("Некоторые товары не найдены.")
            self._product_map = {product.id: product for product in products}

            requested_quantities = defaultdict(int)
            for item in items:
                product_id = item.get('product_id')
                if product_id:
                    requested_quantities[product_id] += int(item.get('quantity') or 0)

            for product_id, requested_qty in requested_quantities.items():
                product = self._product_map[product_id]
                available = int(getattr(product, "stock", 0) or 0)
                if requested_qty > available:
                    raise serializers.ValidationError(
                        f"Товара '{product.name}' недостаточно на складе. Доступно: {available}."
                    )
        return items

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None

        requested_quantities = defaultdict(int)
        product_ids = []
        for item in items_data:
            product_id = item.get('product_id')
            if product_id:
                product_ids.append(product_id)
                requested_quantities[product_id] += int(item.get('quantity') or 0)

        locked_products = {}
        if product_ids:
            locked_qs = Product.objects.select_for_update().filter(id__in=set(product_ids))
            locked_products = {product.id: product for product in locked_qs}
            if len(locked_products) != len(set(product_ids)):
                raise serializers.ValidationError({"detail": "Некоторые товары больше недоступны."})

            for product_id, requested_qty in requested_quantities.items():
                product = locked_products[product_id]
                available = int(getattr(product, "stock", 0) or 0)
                if requested_qty > available:
                    raise serializers.ValidationError(
                        {"detail": f"Товара '{product.name}' недостаточно на складе. Доступно: {available}."}
                    )

        order = Order.objects.create(user=user, **validated_data)
        total = 0

        for item in items_data:
            quantity = item['quantity']
            if item.get('product_id'):
                product = locked_products[item['product_id']]
                price = product.price
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    price=price,
                )
                product.stock = int(product.stock or 0) - quantity
                product.save(update_fields=['stock'])
                total += price * quantity
            else:
                amount = item.get('gift_certificate_amount')
                title = item.get('gift_certificate_name') or f"Подарочный сертификат на {amount} ₽"
                OrderItem.objects.create(
                    order=order,
                    product=None,
                    title=title,
                    is_gift_certificate=True,
                    quantity=quantity,
                    price=amount,
                )
                total += amount * quantity

        order.total_price = total
        order.save(update_fields=['total_price'])
        return order


class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'status',
            'delivery_method',
            'payment_method',
            'payment_provider',
            'payment_id',
            'payment_status',
            'paid_at',
            'full_name',
            'phone',
            'email',
            'city',
            'street',
            'house',
            'apartment',
            'postal_code',
            'comment',
            'total_price',
            'created_at',
            'items',
        ]

    def get_items(self, obj):
        return [
            {
                'product_id': item.product_id,
                'product_name': item.product.name if item.product else item.title,
                'category_name': (
                    item.product.category.name
                    if item.product and item.product.category
                    else "Подарочный сертификат"
                    if item.is_gift_certificate
                    else ""
                ),
                'product_image': (
                    self.context.get('request').build_absolute_uri(f"/api/products/{item.product_id}/image/")
                    if item.product and item.product.external_image_url
                    else
                    self.context.get('request').build_absolute_uri(item.product.image.url)
                    if item.product and item.product.image and self.context.get('request')
                    else f"{settings.MEDIA_URL}{item.product.image}"
                    if item.product and item.product.image
                    else None
                ),
                'is_gift_certificate': item.is_gift_certificate,
                'quantity': item.quantity,
                'price': item.price,
                'line_total': item.line_total,
            }
            for item in obj.items.select_related('product').all()
        ]


class OrderListSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'status',
            'delivery_method',
            'payment_method',
            'payment_status',
            'total_price',
            'created_at',
            'items_count',
        ]

    def get_items_count(self, obj):
        return obj.items.count()