"""
Админ-панель для сотрудников магазина Kokossimo.
Русский интерфейс задаётся в config/urls.py.
"""
from django.contrib import admin
from django.conf import settings
from .models import Category, Product, ProductSubcategory, Profile, Order, OrderItem, ProductRating, Feedback


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    list_per_page = 25
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("name", "slug")}),
        ("Изображение", {"fields": ("image",)}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # В режиме синка МойСклад на сайте используется одна категория (site-kokossimo),
        # остальные категории в админке не актуальны для витрины.
        if getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            qs = qs.filter(slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo"))
        return qs


@admin.register(ProductSubcategory)
class ProductSubcategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "parent_code")
    list_filter = ("parent_code",)
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "category", "product_subcategory", "is_new", "is_bestseller", "discount", "created_at")
    list_filter = ("category", "product_subcategory", "is_new", "is_bestseller")
    search_fields = ("name", "description")
    list_editable = ("price", "is_new", "is_bestseller", "discount")
    list_per_page = 25
    date_hierarchy = "created_at"
    autocomplete_fields = ("category", "product_subcategory")
    fieldsets = (
        (None, {"fields": ("name", "category", "product_subcategory", "description", "price", "image")}),
        ("Главная страница", {"fields": ("is_bestseller", "is_new", "discount")}),
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "category" and getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            kwargs["queryset"] = Category.objects.filter(
                slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo")
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "first_name", "last_name", "phone", "city")
    search_fields = ("user__username", "user__email", "phone", "first_name", "last_name")
    list_per_page = 25
    fieldsets = (
        ("Пользователь", {"fields": ("user",)}),
        ("Контакт", {"fields": ("first_name", "last_name", "phone")}),
        ("Адрес", {"fields": ("city", "street", "house", "apartment", "postal_code")}),
    )


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "title", "is_gift_certificate", "price", "quantity")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "phone",
        "status",
        "delivery_method",
        "payment_method",
        "total_price",
        "created_at",
    )
    list_filter = ("status", "delivery_method", "payment_method", "created_at")
    search_fields = ("full_name", "phone", "email")
    readonly_fields = ("total_price", "created_at", "updated_at")
    list_editable = ("status",)
    list_per_page = 25
    date_hierarchy = "created_at"
    inlines = [OrderItemInline]
    fieldsets = (
        ("Статус и оплата", {"fields": ("status", "delivery_method", "payment_method", "total_price")}),
        ("Клиент", {"fields": ("user", "full_name", "phone", "email", "comment")}),
        ("Адрес доставки", {"fields": ("city", "street", "house", "apartment", "postal_code")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(ProductRating)
class ProductRatingAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "rating", "created_at")
    list_filter = ("rating", "created_at")
    search_fields = ("product__name", "user__username", "user__email")
    list_per_page = 25
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "feedback_type", "text_short", "telegram_username", "is_processed", "created_at")
    list_filter = ("feedback_type", "is_processed", "created_at")
    search_fields = ("text", "telegram_username", "contact_phone", "contact_email")
    readonly_fields = ("telegram_user_id", "telegram_username", "created_at")
    list_editable = ("is_processed",)
    list_per_page = 25
    date_hierarchy = "created_at"
    fieldsets = (
        (None, {"fields": ("feedback_type", "text", "is_processed")}),
        ("Telegram", {"fields": ("telegram_user_id", "telegram_username")}),
        ("Контакты для связи", {"fields": ("contact_phone", "contact_email")}),
        ("Дата", {"fields": ("created_at",)}),
    )

    def text_short(self, obj):
        return (obj.text[:50] + "…") if len(obj.text) > 50 else obj.text

    text_short.short_description = "Текст"
