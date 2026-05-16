"""
Идемпотентно создаёт или обновляет shop_ordercertificateapplication (SQLite / PostgreSQL).
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


def _table_exists(schema_editor, table: str) -> bool:
    names = schema_editor.connection.introspection.table_names()
    table_lower = table.lower()
    return any(name.lower() == table_lower for name in names)


def _drop_order_id(schema_editor, table: str) -> None:
    connection = schema_editor.connection
    if connection.vendor == "postgresql":
        schema_editor.execute(
            f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS '
            "uniq_pending_cert_application_per_order"
        )
        schema_editor.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS order_id")
        return

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=?",
            [table],
        )
        for (index_name,) in cursor.fetchall():
            if "uniq_pending_cert_application_per_order" in index_name:
                schema_editor.execute(f'DROP INDEX IF EXISTS "{index_name}"')
    schema_editor.execute(f'ALTER TABLE "{table}" DROP COLUMN order_id')


def ensure_certificate_application_table(apps, schema_editor):
    Model = apps.get_model("shop", "OrderCertificateApplication")
    table = Model._meta.db_table

    if not _table_exists(schema_editor, table):
        schema_editor.create_model(Model)
        return

    columns = _table_columns(schema_editor, table)
    if "purchase_total" in columns and "order_id" not in columns:
        return

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
            f'UPDATE "{table}" SET purchase_total = amount WHERE purchase_total IS NULL'
        )

    if "order_id" in _table_columns(schema_editor, table):
        _drop_order_id(schema_editor, table)


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
