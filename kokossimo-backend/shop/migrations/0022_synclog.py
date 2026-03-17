from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0021_product_stock"),
    ]

    operations = [
        migrations.CreateModel(
            name="SyncLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("operation", models.CharField(choices=[("full_sync", "Полный sync"), ("full_sync_no_openai", "Полный sync без OpenAI"), ("stock_sync", "Sync остатков"), ("single_product_sync", "Пересинхронизация товара")], max_length=40, verbose_name="Операция")),
                ("status", models.CharField(choices=[("running", "В процессе"), ("success", "Успешно"), ("error", "Ошибка")], default="running", max_length=20, verbose_name="Статус")),
                ("source", models.CharField(blank=True, max_length=30, verbose_name="Источник")),
                ("initiated_by", models.CharField(blank=True, max_length=150, verbose_name="Кем запущено")),
                ("stats", models.JSONField(blank=True, default=dict, verbose_name="Статистика")),
                ("error", models.TextField(blank=True, verbose_name="Ошибка")),
                ("started_at", models.DateTimeField(auto_now_add=True, verbose_name="Начало")),
                ("finished_at", models.DateTimeField(blank=True, null=True, verbose_name="Завершение")),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True, verbose_name="Длительность, мс")),
                ("target_product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sync_logs", to="shop.product", verbose_name="Товар")),
            ],
            options={
                "verbose_name": "Лог синхронизации",
                "verbose_name_plural": "Логи синхронизации",
                "ordering": ["-started_at"],
            },
        ),
    ]
