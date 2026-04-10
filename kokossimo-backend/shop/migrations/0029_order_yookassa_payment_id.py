from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0028_userauthtoken"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="yookassa_payment_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Заполняется при успешной оплате через ЮKassa.",
                max_length=100,
                verbose_name="Идентификатор платежа",
            ),
        ),
    ]

