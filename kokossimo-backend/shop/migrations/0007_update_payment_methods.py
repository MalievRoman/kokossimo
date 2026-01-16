from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0006_order_models'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='payment_method',
            field=models.CharField(choices=[('cash_on_delivery', 'Наличными курьеру'), ('cash_pickup', 'На кассе при самовывозе')], default='cash_on_delivery', max_length=20, verbose_name='Способ оплаты'),
        ),
    ]
