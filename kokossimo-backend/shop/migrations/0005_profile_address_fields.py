from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0004_profile_address'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='profile',
            name='delivery_address',
        ),
        migrations.AddField(
            model_name='profile',
            name='apartment',
            field=models.CharField(blank=True, max_length=50, verbose_name='Квартира'),
        ),
        migrations.AddField(
            model_name='profile',
            name='city',
            field=models.CharField(blank=True, max_length=150, verbose_name='Город'),
        ),
        migrations.AddField(
            model_name='profile',
            name='house',
            field=models.CharField(blank=True, max_length=50, verbose_name='Дом'),
        ),
        migrations.AddField(
            model_name='profile',
            name='postal_code',
            field=models.CharField(blank=True, max_length=20, verbose_name='Индекс'),
        ),
        migrations.AddField(
            model_name='profile',
            name='street',
            field=models.CharField(blank=True, max_length=200, verbose_name='Улица'),
        ),
    ]
