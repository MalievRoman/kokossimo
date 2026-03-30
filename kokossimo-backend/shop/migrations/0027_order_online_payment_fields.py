from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0026_favorites_models"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("cash_on_delivery", "Наличными курьеру"),
                    ("cash_pickup", "На кассе при самовывозе"),
                    ("card_online", "Карта онлайн (ЮKassa)"),
                ],
                default="cash_on_delivery",
                max_length=20,
                verbose_name="Способ оплаты",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Оплачен в"),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=100,
                null=True,
                verbose_name="ID платежа провайдера",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_provider",
            field=models.CharField(blank=True, default="", max_length=30, verbose_name="Провайдер оплаты"),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(blank=True, default="", max_length=30, verbose_name="Статус платежа"),
        ),
    ]
