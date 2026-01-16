from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0007_update_payment_methods'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_method',
            field=models.CharField(choices=[('courier', 'Курьерская доставка'), ('pickup', 'Самовывоз')], default='courier', max_length=20, verbose_name='Способ доставки'),
        ),
    ]
