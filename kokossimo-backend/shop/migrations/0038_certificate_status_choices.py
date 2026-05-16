# Статусы сертификата — только state (managed=False).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0037_certificate_table_schema"),
    ]

    _STATUS_CHOICES = [
        (
            "created",
            "Создан — в UI введены номинал, получатель и срок действия",
        ),
        (
            "partially_redeemed",
            "Частично списан — использован не полностью",
        ),
        ("redeemed", "Полностью списан"),
        ("expired", "Истёк срок действия"),
        ("blocked", "Заблокирован"),
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
