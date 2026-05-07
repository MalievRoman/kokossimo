from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0029_order_yookassa_payment_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_confirmation_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Ссылка на страницу оплаты (confirmation_url) для возврата к неоплаченному платежу.",
                verbose_name="Ссылка на оплату",
            ),
        ),
    ]

