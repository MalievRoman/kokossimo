from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse, JsonResponse
from django.template.loader import render_to_string
import os
from rest_framework.routers import DefaultRouter
from shop.views import (
    ProductViewSet,
    CategoryViewSet,
    ProductSubcategoryViewSet,
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
    rate_product_missing_trailing_slash,
    product_image_proxy,
    moysklad_status,
    moysklad_assortment,
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
                "synclog",
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

# Юридические документы из папки legal_info
LEGAL_INFO_DIR = os.path.join(settings.BASE_DIR, 'legal_info')
ALLOWED_LEGAL_SLUGS = ('privacy', 'offer', 'subscription')


def legal_document_view(request, slug):
    if request.method != 'GET':
        return JsonResponse({"detail": "Method not allowed."}, status=405)
    if slug not in ALLOWED_LEGAL_SLUGS:
        return JsonResponse({"detail": "Not found."}, status=404)
    for ext in ('.md', '.txt', '.html'):
        path = os.path.join(LEGAL_INFO_DIR, f'{slug}{ext}')
        if os.path.isfile(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except OSError:
                return JsonResponse({"detail": "Error reading file."}, status=500)
            titles = {
                'privacy': 'Политика в отношении обработки персональных данных',
                'offer': 'Публичная оферта о заключении договора купли-продажи',
                'subscription': 'Согласие на использование персональных данных',
            }
            return JsonResponse({"title": titles.get(slug, slug), "content": content})
    return JsonResponse({"detail": "Document not found."}, status=404)


# Создаем роутер для API
router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'product-subcategories', ProductSubcategoryViewSet, basename='product-subcategory')

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
    path('api/products/<int:product_id>/image/', product_image_proxy),
    path('api/products/<int:product_id>/rate', rate_product_missing_trailing_slash),
    path('api/products/<int:product_id>/rate/', rate_product),
    path('api/integrations/moysklad/status/', moysklad_status),
    path('api/integrations/moysklad/assortment/', moysklad_assortment),
    path('api/legal/<str:slug>/', legal_document_view),
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
