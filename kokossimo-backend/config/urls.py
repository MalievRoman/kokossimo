from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from shop.views import (
    ProductViewSet,
    CategoryViewSet,
    register_user,
    login_user,
    send_email_code,
    verify_email_code,
    logout_user,
    current_user,
    update_profile,
    create_order,
    list_orders,
    order_detail,
)

# Создаем роутер для API
router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)), # Все API будут начинаться с /api/
    path('api/auth/register/', register_user),
    path('api/auth/login/', login_user),
    path('api/auth/email/send/', send_email_code),
    path('api/auth/email/verify/', verify_email_code),
    path('api/auth/logout/', logout_user),
    path('api/auth/me/', current_user),
    path('api/auth/profile/', update_profile),
    path('api/orders/', create_order),
    path('api/orders/list/', list_orders),
    path('api/orders/<int:order_id>/', order_detail),
]

# Это нужно, чтобы Django раздавал картинки (media) в режиме разработки
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
