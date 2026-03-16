from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('shop', '0019_add_bady_parfum_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='birth_date',
            field=models.DateField(blank=True, null=True, verbose_name='Дата рождения'),
        ),
    ]
