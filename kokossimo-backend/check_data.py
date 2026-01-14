#!/usr/bin/env python
"""
Скрипт для проверки данных в базе
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from shop.models import Product, Category

print("=" * 50)
print("ПРОВЕРКА ДАННЫХ В БАЗЕ")
print("=" * 50)

categories_count = Category.objects.count()
products_count = Product.objects.count()
bestsellers_count = Product.objects.filter(is_bestseller=True).count()
new_products_count = Product.objects.filter(is_new=True).count()

print(f"\nКатегорий в базе: {categories_count}")
print(f"Товаров в базе: {products_count}")
print(f"Бестселлеров: {bestsellers_count}")
print(f"Новинок: {new_products_count}")

if categories_count == 0 or products_count == 0:
    print("\n⚠️  ВНИМАНИЕ: Данные не загружены!")
    print("Выполните команду для загрузки данных:")
    print("  python manage.py loaddata shop/fixtures/initial_data.json")
else:
    print("\n✅ Данные загружены успешно!")
    
    if bestsellers_count == 0:
        print("⚠️  Нет бестселлеров в базе!")
    if new_products_count == 0:
        print("⚠️  Нет новинок в базе!")

print("\n" + "=" * 50)
