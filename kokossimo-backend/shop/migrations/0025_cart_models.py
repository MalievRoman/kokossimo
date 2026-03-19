from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0024_product_specs_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Cart',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='cart', to=settings.AUTH_USER_MODEL, verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Корзина',
                'verbose_name_plural': 'Корзины',
            },
        ),
        migrations.CreateModel(
            name='CartItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('external_id', models.CharField(blank=True, default='', max_length=120, verbose_name='Внешний ID')),
                ('title', models.CharField(blank=True, default='', max_length=255, verbose_name='Название')),
                ('is_gift_certificate', models.BooleanField(default=False, verbose_name='Подарочный сертификат')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество')),
                ('unit_price', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Цена за единицу')),
                ('discount', models.PositiveIntegerField(default=0, verbose_name='Скидка %')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cart', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='shop.cart')),
                ('product', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cart_items', to='shop.product', verbose_name='Товар')),
            ],
            options={
                'verbose_name': 'Позиция корзины',
                'verbose_name_plural': 'Позиции корзины',
            },
        ),
        migrations.AddConstraint(
            model_name='cartitem',
            constraint=models.UniqueConstraint(condition=models.Q(('product__isnull', False)), fields=('cart', 'product'), name='uniq_cartitem_cart_product'),
        ),
        migrations.AddConstraint(
            model_name='cartitem',
            constraint=models.UniqueConstraint(condition=models.Q(('is_gift_certificate', True)), fields=('cart', 'external_id'), name='uniq_cartitem_cart_gift_external_id'),
        ),
    ]
