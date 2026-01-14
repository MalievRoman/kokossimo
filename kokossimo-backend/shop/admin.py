from django.contrib import admin
from .models import Category, Product

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
