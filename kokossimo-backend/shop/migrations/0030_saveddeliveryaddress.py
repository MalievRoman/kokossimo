from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0029_order_yookassa_payment_id'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SavedDeliveryAddress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('city', models.CharField(max_length=150, verbose_name='Город')),
                ('street_house', models.CharField(max_length=255, verbose_name='Улица и дом')),
                ('entrance', models.CharField(max_length=50, verbose_name='Подъезд')),
                ('floor', models.CharField(max_length=50, verbose_name='Этаж')),
                ('apartment_office', models.CharField(max_length=100, verbose_name='Квартира / офис')),
                ('intercom', models.CharField(max_length=100, verbose_name='Домофон')),
                ('comment', models.TextField(blank=True, default='', verbose_name='Комментарий')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создан')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Обновлен')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saved_delivery_addresses', to=settings.AUTH_USER_MODEL, verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Сохраненный адрес доставки',
                'verbose_name_plural': 'Сохраненные адреса доставки',
                'ordering': ['-updated_at', '-created_at', '-id'],
            },
        ),
    ]
