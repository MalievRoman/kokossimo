from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0008_add_delivery_method'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='title',
            field=models.CharField(blank=True, max_length=200, verbose_name='Название'),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='is_gift_certificate',
            field=models.BooleanField(default=False, verbose_name='Подарочный сертификат'),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='product',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='order_items', to='shop.product'),
        ),
    ]
