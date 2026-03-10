from django.db import migrations


# Большие категории БАДы (5) и Парфюмерия (6) с подкатегориями
NEW_SUBCATEGORIES = [
    ("5", "БАДы", ""),
    ("5.1", "витамины", "5"),
    ("5.2", "минералы", "5"),
    ("5.3", "для красоты", "5"),
    ("5.4", "для иммунитета", "5"),
    ("5.5", "для пищеварения", "5"),
    ("5.6", "прочее", "5"),
    ("6", "Парфюмерия", ""),
    ("6.1", "женская", "6"),
    ("6.2", "мужская", "6"),
    ("6.3", "унисекс", "6"),
    ("6.4", "миниатюры", "6"),
    ("6.5", "аксессуары", "6"),
]


def forwards(apps, schema_editor):
    ProductSubcategory = apps.get_model("shop", "ProductSubcategory")
    for code, name, parent_code in NEW_SUBCATEGORIES:
        ProductSubcategory.objects.get_or_create(
            code=code,
            defaults={"name": name, "parent_code": parent_code},
        )


def backwards(apps, schema_editor):
    ProductSubcategory = apps.get_model("shop", "ProductSubcategory")
    ProductSubcategory.objects.filter(code__in=[c[0] for c in NEW_SUBCATEGORIES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0018_alter_category_id_alter_emailverificationcode_id_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
