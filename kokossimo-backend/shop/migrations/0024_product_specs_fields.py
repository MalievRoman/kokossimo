from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0023_synclog_runtime_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="composition",
            field=models.TextField(blank=True, default="", verbose_name="Состав"),
        ),
        migrations.AddField(
            model_name="product",
            name="usage_instructions",
            field=models.TextField(blank=True, default="", verbose_name="Способ применения"),
        ),
    ]
