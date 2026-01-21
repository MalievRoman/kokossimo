from rest_framework import serializers
from django.db import transaction
from .models import Product, Category, Profile, Order, OrderItem
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

class ProductSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source='category.slug', read_only=True) # Чтобы фронт знал слаг категории
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 
            'name', 
            'description', 
            'price', 
            'image', 
            'category_slug',
            'is_bestseller', 
            'is_new', 
            'discount'
        ]
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return f"{settings.MEDIA_URL}{obj.image}"
        return None


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
    city = serializers.CharField(required=False, allow_blank=True)
    street = serializers.CharField(required=False, allow_blank=True)
    house = serializers.CharField(required=False, allow_blank=True)
    apartment = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True)


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
        return items

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None

        order = Order.objects.create(user=user, **validated_data)
        total = 0

        product_map = getattr(self, '_product_map', {})
        for item in items_data:
            quantity = item['quantity']
            if item.get('product_id'):
                product = product_map.get(item['product_id'])
                price = product.price
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    price=price,
                )
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
                'product_image': (
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
            'total_price',
            'created_at',
            'items_count',
        ]

    def get_items_count(self, obj):
        return obj.items.count()