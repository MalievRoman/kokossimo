from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.template.loader import render_to_string
import os
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
    product_ratings,
    rate_product,
)

# Оформление админки для сотрудников магазина
admin.site.site_header = "Kokossimo — Панель управления"
admin.site.site_title = "Kokossimo"
admin.site.index_title = "Управление магазином"

# Порядок разделов в админке: заказы и обращения первыми
_original_get_app_list = admin.site.get_app_list


def _kokossimo_get_app_list(request):
    app_list = _original_get_app_list(request)
    for app in app_list:
        if app["app_label"] == "shop":
            order = [
                "order",
                "feedback",
                "product",
                "category",
                "profile",
                "productrating",
            ]
            app["models"].sort(
                key=lambda m: order.index(m["object_name"].lower())
                if m["object_name"].lower() in order else 99
            )
    return app_list


admin.site.get_app_list = _kokossimo_get_app_list

# View для отдачи React приложения
def react_app_view(request):
    """Отдает index.html из собранного фронтенда"""
    frontend_dist = os.path.join(settings.BASE_DIR.parent, 'kokossimo-frontend', 'dist', 'index.html')
    
    # Если есть собранный index.html из фронтенда, используем его
    if os.path.exists(frontend_dist):
        with open(frontend_dist, 'r', encoding='utf-8') as f:
            content = f.read()
        return HttpResponse(content, content_type='text/html')
    
    # Иначе используем шаблон Django
    return TemplateView.as_view(template_name='index.html')(request)

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
    path('api/products/<int:product_id>/ratings/', product_ratings),
    path('api/products/<int:product_id>/rate/', rate_product),
]

# Отдача React приложения для всех остальных маршрутов (SPA)
# Это должно быть в конце, чтобы не перехватывать API маршруты
urlpatterns += [
    re_path(r'^(?!api|admin|static|media).*', react_app_view),
]

# Это нужно, чтобы Django раздавал картинки (media) в режиме разработки
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
