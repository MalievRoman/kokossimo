from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0014_product_external_image_url"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="name",
            field=models.CharField(max_length=500, verbose_name="Название товара"),
        ),
    ]
