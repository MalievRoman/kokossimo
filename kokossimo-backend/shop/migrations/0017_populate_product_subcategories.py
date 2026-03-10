from django.db import migrations


# Список подкатегорий: (code, name, parent_code)
# Родители: 1 — Косметика для лица, 2 — Макияж, 3 — Средства для тела, 4 — Средства для волос
SUBCATEGORIES = [
    ("1", "Косметика для лица", ""),
    ("1.1", "очищение", "1"),
    ("1.2", "тонизирование", "1"),
    ("1.3", "для кожи вокруг глаз", "1"),
    ("1.4", "защита от солнца", "1"),
    ("1.5", "пилинги", "1"),
    ("1.6", "увлажнение", "1"),
    ("1.7", "направленный уход", "1"),
    ("1.8", "маски", "1"),
    ("2", "Макияж", ""),
    ("2.1", "для лица", "2"),
    ("2.2", "для глаз и бровей", "2"),
    ("2.3", "для губ", "2"),
    ("2.4", "аксессуары для макияжа", "2"),
    ("3", "Средства для тела", ""),
    ("3.1", "для душа", "3"),
    ("3.2", "для ванны", "3"),
    ("3.3", "уход", "3"),
    ("3.4", "гигиена", "3"),
    ("3.5", "для рук", "3"),
    ("3.6", "уход за полостью рта", "3"),
    ("3.7", "для ног", "3"),
    ("4", "Средства для волос", ""),
    ("4.1", "шампуни", "4"),
    ("4.2", "кондиционеры", "4"),
    ("4.3", "уход за кожей головы", "4"),
    ("4.4", "уход для волос", "4"),
    ("4.5", "аксессуары для волос", "4"),
    ("4.6", "стайлинг", "4"),
]


def forwards(apps, schema_editor):
    ProductSubcategory = apps.get_model("shop", "ProductSubcategory")
    for code, name, parent_code in SUBCATEGORIES:
        ProductSubcategory.objects.get_or_create(
            code=code,
            defaults={"name": name, "parent_code": parent_code},
        )


def backwards(apps, schema_editor):
    ProductSubcategory = apps.get_model("shop", "ProductSubcategory")
    ProductSubcategory.objects.filter(code__in=[c[0] for c in SUBCATEGORIES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0016_product_subcategory"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
