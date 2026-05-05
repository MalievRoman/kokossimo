from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0030_saveddeliveryaddress"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "Новый"),
                    ("awaiting_payment", "Ожидает оплаты"),
                    ("processing", "В обработке"),
                    ("paid", "Оплачен"),
                    ("shipped", "Отправлен"),
                    ("delivered", "Доставлен"),
                    ("cancelled", "Отменен"),
                ],
                default="new",
                max_length=20,
                verbose_name="Статус",
            ),
        ),
    ]
