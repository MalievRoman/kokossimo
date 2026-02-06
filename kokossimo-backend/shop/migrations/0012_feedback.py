from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0011_product_rating"),
    ]

    operations = [
        migrations.CreateModel(
            name="Feedback",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "feedback_type",
                    models.CharField(
                        choices=[
                            ("review", "Отзыв"),
                            ("suggestion", "Предложение"),
                            ("contact_request", "Просьба о связи"),
                        ],
                        max_length=20,
                        verbose_name="Тип",
                    ),
                ),
                ("text", models.TextField(verbose_name="Текст сообщения")),
                ("telegram_user_id", models.BigIntegerField(blank=True, null=True, verbose_name="Telegram user ID")),
                ("telegram_username", models.CharField(blank=True, max_length=100, verbose_name="Telegram @username")),
                ("contact_phone", models.CharField(blank=True, max_length=30, verbose_name="Телефон для связи")),
                ("contact_email", models.EmailField(blank=True, max_length=254, verbose_name="Email для связи")),
                ("is_processed", models.BooleanField(default=False, verbose_name="Обработано")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")),
            ],
            options={
                "verbose_name": "Обратная связь",
                "verbose_name_plural": "Обратная связь",
                "ordering": ["-created_at"],
            },
        ),
    ]
