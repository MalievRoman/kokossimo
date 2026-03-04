from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0012_feedback"),
        ("shop", "0012_alter_category_id_alter_emailverificationcode_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="moysklad_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=64,
                null=True,
                unique=True,
                verbose_name="ID в МойСклад",
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="image",
            field=models.ImageField(
                blank=True, null=True, upload_to="products/", verbose_name="Основное фото"
            ),
        ),
    ]
