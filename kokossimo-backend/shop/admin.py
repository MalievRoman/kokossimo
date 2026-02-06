"""
Админ-панель для сотрудников магазина Kokossimo.
Русский интерфейс задаётся в config/urls.py.
"""
from django.contrib import admin
from .models import Category, Product, Profile, Order, OrderItem, ProductRating, Feedback


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


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "category", "is_new", "is_bestseller", "discount", "created_at")
    list_filter = ("category", "is_new", "is_bestseller")
    search_fields = ("name", "description")
    list_editable = ("price", "is_new", "is_bestseller", "discount")
    list_per_page = 25
    date_hierarchy = "created_at"
    autocomplete_fields = ("category",)
    fieldsets = (
        (None, {"fields": ("name", "category", "description", "price", "image")}),
        ("Главная страница", {"fields": ("is_bestseller", "is_new", "discount")}),
    )


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
