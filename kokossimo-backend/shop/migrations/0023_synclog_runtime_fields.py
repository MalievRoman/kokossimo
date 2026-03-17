from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0022_synclog"),
    ]

    operations = [
        migrations.AddField(
            model_name="synclog",
            name="log_output",
            field=models.TextField(blank=True, verbose_name="Вывод синхронизации"),
        ),
        migrations.AddField(
            model_name="synclog",
            name="stop_requested",
            field=models.BooleanField(default=False, verbose_name="Запрошена остановка"),
        ),
        migrations.AlterField(
            model_name="synclog",
            name="status",
            field=models.CharField(
                choices=[
                    ("running", "В процессе"),
                    ("success", "Успешно"),
                    ("stopped", "Остановлено"),
                    ("error", "Ошибка"),
                ],
                default="running",
                max_length=20,
                verbose_name="Статус",
            ),
        ),
    ]
