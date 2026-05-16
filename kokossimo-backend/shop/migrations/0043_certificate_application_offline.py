from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0042_order_certificate_application"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="ordercertificateapplication",
            name="uniq_pending_cert_application_per_order",
        ),
        migrations.AddField(
            model_name="ordercertificateapplication",
            name="purchase_total",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=10,
                verbose_name="Сумма покупки",
            ),
            preserve_default=False,
        ),
        migrations.RemoveField(
            model_name="ordercertificateapplication",
            name="order",
        ),
        migrations.AlterModelOptions(
            name="ordercertificateapplication",
            options={
                "ordering": ["-created_at", "-id"],
                "verbose_name": "Применение сертификата",
                "verbose_name_plural": "Применения сертификатов",
            },
        ),
    ]
