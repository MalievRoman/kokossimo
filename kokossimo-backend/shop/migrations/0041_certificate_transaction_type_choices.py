# Типы операций certificate_transactions — только state (managed=False).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0040_certificate_transaction"),
    ]

    _TYPE_CHOICES = [
        ("issue", "issue"),
        ("redeem", "redeem"),
        ("refund", "refund"),
        ("adjustment", "adjustment"),
        ("block", "block"),
        ("unblock", "unblock"),
        ("expire", "expire"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="certificatetransaction",
                    name="type",
                    field=models.CharField(
                        blank=True,
                        choices=_TYPE_CHOICES,
                        max_length=50,
                        null=True,
                        verbose_name="Тип операции",
                    ),
                ),
            ],
        ),
    ]
