from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from .models import Product, Category, Profile, Order
from .serializers import (
    ProductSerializer,
    CategorySerializer,
    RegisterSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    OrderListSerializer,
)

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_queryset(self):
        # Фильтрация товаров через параметры URL
        # Пример: /api/products/?is_new=true&category=face
        queryset = Product.objects.all()
        
        is_new = self.request.query_params.get('is_new', None)
        is_bestseller = self.request.query_params.get('is_bestseller', None)
        category_slug = self.request.query_params.get('category', None)

        if is_new == 'true':
            queryset = queryset.filter(is_new=True)
        
        if is_bestseller == 'true':
            queryset = queryset.filter(is_bestseller=True)

        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        return queryset
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


@api_view(['POST'])
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