from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0027_order_online_payment_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAuthToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(db_index=True, max_length=40, unique=True, verbose_name="Token")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создан")),
                ("last_used_at", models.DateTimeField(blank=True, null=True, verbose_name="Последнее использование")),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="auth_tokens",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Пользователь",
                    ),
                ),
            ],
            options={
                "verbose_name": "Токен авторизации",
                "verbose_name_plural": "Токены авторизации",
                "ordering": ["-created_at"],
            },
        ),
    ]

