from django.conf import settings
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0010_email_verification_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductRating",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "rating",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ],
                        verbose_name="Оценка",
                    ),
                ),
                ("comment", models.TextField(blank=True, verbose_name="Отзыв")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "product",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="ratings", to="shop.product", verbose_name="Товар"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="product_ratings", to=settings.AUTH_USER_MODEL, verbose_name="Пользователь"),
                ),
            ],
            options={
                "verbose_name": "Оценка товара",
                "verbose_name_plural": "Оценки товаров",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="productrating",
            constraint=models.UniqueConstraint(fields=("product", "user"), name="unique_product_user_rating"),
        ),
    ]
