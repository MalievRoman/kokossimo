from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0044_merge_20260516_1143"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="certificate",
            options={
                "verbose_name": "Сертификат",
                "verbose_name_plural": "Сертификаты",
                "ordering": ["-created_at", "-id"],
                "managed": False,
            },
        ),
    ]
