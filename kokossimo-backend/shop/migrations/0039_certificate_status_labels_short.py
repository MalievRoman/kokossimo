# Подписи статусов в choices — только коды, без описаний (managed=False).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0038_certificate_status_choices"),
    ]

    _STATUS_CHOICES = [
        ("created", "created"),
        ("partially_redeemed", "partially_redeemed"),
        ("redeemed", "redeemed"),
        ("expired", "expired"),
        ("blocked", "blocked"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="certificate",
                    name="status",
                    field=models.CharField(
                        choices=_STATUS_CHOICES,
                        default="created",
                        max_length=50,
                        verbose_name="Статус",
                    ),
                ),
            ],
        ),
    ]
