from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0013_moysklad_product_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="external_image_url",
            field=models.URLField(
                blank=True,
                null=True,
                verbose_name="Внешняя ссылка на фото",
            ),
        ),
    ]
