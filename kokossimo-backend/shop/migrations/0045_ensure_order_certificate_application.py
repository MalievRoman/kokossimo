"""
Идемпотентно создаёт или обновляет shop_ordercertificateapplication.
Нужно, если merge-миграции применены, а 0042 фактически не создала таблицу.
"""

from decimal import Decimal

from django.db import migrations, models


def _table_columns(schema_editor, table: str) -> set[str]:
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == "sqlite":
            cursor.execute(f'PRAGMA table_info("{table}")')
            return {row[1] for row in cursor.fetchall()}
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = %s
            """,
            [table],
        )
        return {row[0] for row in cursor.fetchall()}


def _upgrade_old_schema(apps, schema_editor, table: str) -> None:
    Model = apps.get_model("shop", "OrderCertificateApplication")
    columns = _table_columns(schema_editor, table)

    if "purchase_total" not in columns:
        purchase_field = models.DecimalField(
            max_digits=10,
            decimal_places=2,
            default=Decimal("0"),
            verbose_name="Сумма покупки",
        )
        purchase_field.set_attributes_from_name("purchase_total")
        schema_editor.add_field(Model, purchase_field)
        schema_editor.execute(
            f"UPDATE {table} SET purchase_total = amount WHERE purchase_total IS NULL"
        )

    if "order_id" not in _table_columns(schema_editor, table):
        return

    connection = schema_editor.connection
    if connection.vendor == "postgresql":
        schema_editor.execute(
            f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS '
            "uniq_pending_cert_application_per_order"
        )
        schema_editor.execute(
            f"ALTER TABLE {table} DROP COLUMN IF EXISTS order_id"
        )


def ensure_certificate_application_table(apps, schema_editor):
    Model = apps.get_model("shop", "OrderCertificateApplication")
    table = Model._meta.db_table
    connection = schema_editor.connection

    if table not in connection.introspection.table_names():
        schema_editor.create_model(Model)
        return

    columns = _table_columns(schema_editor, table)
    if "purchase_total" in columns:
        return

    if "order_id" in columns:
        _upgrade_old_schema(apps, schema_editor, table)
        return

    purchase_field = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Сумма покупки",
    )
    purchase_field.set_attributes_from_name("purchase_total")
    schema_editor.add_field(Model, purchase_field)


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0044_merge_20260516_1143"),
    ]

    operations = [
        migrations.RunPython(
            ensure_certificate_application_table,
            migrations.RunPython.noop,
        ),
    ]
