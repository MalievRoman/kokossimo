# Схема таблицы certificates изменена вне Django (PostgreSQL). Обновляем только state.

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0036_certificate_is_used"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="Certificate"),
                migrations.CreateModel(
                    name="Certificate",
                    fields=[
                        (
                            "id",
                            models.CharField(
                                max_length=16,
                                primary_key=True,
                                serialize=False,
                                verbose_name="ID",
                            ),
                        ),
                        (
                            "status",
                            models.CharField(
                                default="created",
                                max_length=50,
                                verbose_name="Статус",
                            ),
                        ),
                        (
                            "currency",
                            models.CharField(
                                default="RUB",
                                max_length=3,
                                verbose_name="Валюта",
                            ),
                        ),
                        (
                            "initial_amount",
                            models.DecimalField(
                                blank=True,
                                decimal_places=2,
                                max_digits=10,
                                null=True,
                                verbose_name="Исходный номинал",
                            ),
                        ),
                        (
                            "current_balance",
                            models.DecimalField(
                                blank=True,
                                decimal_places=2,
                                max_digits=10,
                                null=True,
                                verbose_name="Текущий остаток",
                            ),
                        ),
                        (
                            "expires_at",
                            models.DateTimeField(
                                blank=True,
                                null=True,
                                verbose_name="Истекает",
                            ),
                        ),
                        (
                            "created_at",
                            models.DateTimeField(
                                default=django.utils.timezone.now,
                                verbose_name="Создан",
                            ),
                        ),
                        (
                            "updated_at",
                            models.DateTimeField(
                                default=django.utils.timezone.now,
                                verbose_name="Обновлён",
                            ),
                        ),
                        (
                            "created_by",
                            models.IntegerField(
                                blank=True,
                                null=True,
                                verbose_name="Кем создан (user id)",
                            ),
                        ),
                        (
                            "owner_customer_id",
                            models.IntegerField(
                                blank=True,
                                null=True,
                                verbose_name="ID клиента-владельца",
                            ),
                        ),
                        (
                            "source_channel",
                            models.IntegerField(
                                blank=True,
                                null=True,
                                verbose_name="Канал выпуска",
                            ),
                        ),
                        (
                            "metadata",
                            models.JSONField(
                                blank=True,
                                default=dict,
                                verbose_name="Метаданные",
                            ),
                        ),
                    ],
                    options={
                        "verbose_name": "Сертификат",
                        "verbose_name_plural": "Сертификаты",
                        "db_table": "certificates",
                        "ordering": ["-created_at", "-id"],
                        "managed": False,
                    },
                ),
            ],
        ),
    ]
