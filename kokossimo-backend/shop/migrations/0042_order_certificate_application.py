from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0041_certificate_transaction_type_choices"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="certificate_discount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=10,
                verbose_name="Скидка по сертификату",
            ),
        ),
        migrations.CreateModel(
            name="OrderCertificateApplication",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "certificate_id",
                    models.CharField(max_length=16, verbose_name="Номер сертификата"),
                ),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        verbose_name="Сумма списания",
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
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Ожидает списания"),
                            ("finalized", "Списано"),
                            ("cancelled", "Отменено"),
                        ],
                        default="pending",
                        max_length=20,
                        verbose_name="Статус",
                    ),
                ),
                (
                    "performed_by",
                    models.IntegerField(
                        blank=True,
                        null=True,
                        verbose_name="Кто применил (user id)",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Создано"),
                ),
                (
                    "finalized_at",
                    models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="Списано",
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="certificate_applications",
                        to="shop.order",
                        verbose_name="Заказ",
                    ),
                ),
            ],
            options={
                "verbose_name": "Применение сертификата к заказу",
                "verbose_name_plural": "Применения сертификатов к заказам",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="ordercertificateapplication",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "pending")),
                fields=("order",),
                name="uniq_pending_cert_application_per_order",
            ),
        ),
        migrations.AddConstraint(
            model_name="ordercertificateapplication",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "pending")),
                fields=("certificate_id",),
                name="uniq_pending_cert_application_per_certificate",
            ),
        ),
    ]
