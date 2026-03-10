from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0015_product_name_max_length_500"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductSubcategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=20, unique=True, verbose_name="Код")),
                ("name", models.CharField(max_length=200, verbose_name="Название")),
                ("parent_code", models.CharField(blank=True, max_length=20, verbose_name="Код родителя")),
            ],
            options={
                "verbose_name": "Подкатегория товара",
                "verbose_name_plural": "Подкатегории товаров",
                "ordering": ["code"],
            },
        ),
        migrations.AddField(
            model_name="product",
            name="product_subcategory",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="products",
                to="shop.productsubcategory",
                verbose_name="Подкатегория (тип товара)",
            ),
        ),
    ]
