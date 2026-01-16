from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0005_profile_address_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Order',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('new', 'Новый'), ('processing', 'В обработке'), ('paid', 'Оплачен'), ('shipped', 'Отправлен'), ('delivered', 'Доставлен'), ('cancelled', 'Отменен')], default='new', max_length=20, verbose_name='Статус')),
                ('payment_method', models.CharField(choices=[('card', 'Карта онлайн'), ('cash', 'Наличными'), ('transfer', 'Банковский перевод')], default='card', max_length=20, verbose_name='Способ оплаты')),
                ('full_name', models.CharField(max_length=200, verbose_name='Имя и фамилия')),
                ('phone', models.CharField(max_length=30, verbose_name='Телефон')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('city', models.CharField(max_length=150, verbose_name='Город')),
                ('street', models.CharField(max_length=200, verbose_name='Улица')),
                ('house', models.CharField(max_length=50, verbose_name='Дом')),
                ('apartment', models.CharField(blank=True, max_length=50, verbose_name='Квартира')),
                ('postal_code', models.CharField(blank=True, max_length=20, verbose_name='Индекс')),
                ('comment', models.TextField(blank=True, verbose_name='Комментарий')),
                ('total_price', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Сумма заказа')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='orders', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Заказ',
                'verbose_name_plural': 'Заказы',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='OrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество')),
                ('price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Цена на момент заказа')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='shop.order')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='order_items', to='shop.product')),
            ],
            options={
                'verbose_name': 'Позиция заказа',
                'verbose_name_plural': 'Позиции заказа',
            },
        ),
    ]
