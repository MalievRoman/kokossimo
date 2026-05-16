# Колонка is_used добавлена вне Django; синхронизируем только state модели.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0035_certificate"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name="certificate",
                    name="is_used",
                    field=models.BooleanField(
                        default=False,
                        verbose_name="Использован",
                    ),
                ),
            ],
        ),
    ]
