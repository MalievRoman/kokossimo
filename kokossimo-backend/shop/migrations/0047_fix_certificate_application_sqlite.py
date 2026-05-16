"""Повторное исправление таблицы на SQLite (если 0045 уже была применена без DROP order_id)."""

import importlib

from django.db import migrations


def _ensure_table(apps, schema_editor):
    module = importlib.import_module(
        "shop.migrations.0045_ensure_order_certificate_application"
    )
    module.ensure_certificate_application_table(apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0046_merge_20260516_1231"),
    ]

    operations = [
        migrations.RunPython(_ensure_table, migrations.RunPython.noop),
    ]
