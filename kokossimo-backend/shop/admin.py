from django.contrib import admin
from .models import Category, Product, Profile, Order, OrderItem

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)} # Автоматически заполняет slug из названия

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'category', 'is_new', 'is_bestseller', 'discount')
    list_filter = ('category', 'is_new', 'is_bestseller')
    search_fields = ('name', 'description')
    list_editable = ('price', 'is_new', 'is_bestseller', 'discount') # Можно править прямо в списке


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'first_name', 'last_name', 'phone')
    search_fields = ('user__username', 'user__email', 'phone', 'first_name', 'last_name')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'title', 'is_gift_certificate', 'price', 'quantity')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'phone', 'status', 'delivery_method', 'payment_method', 'total_price', 'created_at')
    list_filter = ('status', 'delivery_method', 'payment_method', 'created_at')
    search_fields = ('full_name', 'phone', 'email')
    readonly_fields = ('total_price', 'created_at', 'updated_at')
    inlines = [OrderItemInline]
