from rest_framework import viewsets
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer

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