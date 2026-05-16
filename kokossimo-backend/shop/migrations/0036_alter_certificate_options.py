# Параллельная ветка от 0035 (есть на сервере). Сливается в 0042_merge.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0035_certificate"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="certificate",
            options={
                "verbose_name": "Сертификат",
                "verbose_name_plural": "Сертификаты",
                "ordering": ["-issue_date", "-id"],
                "managed": False,
            },
        ),
    ]
