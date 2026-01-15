from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0003_profile_names'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='delivery_address',
            field=models.TextField(blank=True, verbose_name='Адрес доставки'),
        ),
    ]
