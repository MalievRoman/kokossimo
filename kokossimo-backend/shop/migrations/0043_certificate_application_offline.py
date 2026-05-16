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
            WHERE table_name = %s
            """,
            [table],
        )
        return {row[0] for row in cursor.fetchall()}


def upgrade_offline_schema(apps, schema_editor):
    """
    Старая 0042 создавала поле order — переводим на офлайн-схему.
    Новая 0042 уже содержит purchase_total — ничего не делаем.
    """
    table = "shop_ordercertificateapplication"
    columns = _table_columns(schema_editor, table)
    if "purchase_total" in columns:
        return
    if "order_id" not in columns:
        return

    OrderCertificateApplication = apps.get_model("shop", "OrderCertificateApplication")

    purchase_field = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Сумма покупки",
    )
    purchase_field.set_attributes_from_name("purchase_total")
    schema_editor.add_field(OrderCertificateApplication, purchase_field)
    schema_editor.execute(
        "UPDATE shop_ordercertificateapplication SET purchase_total = amount"
    )

    for constraint in OrderCertificateApplication._meta.constraints:
        if constraint.name == "uniq_pending_cert_application_per_order":
            schema_editor.remove_constraint(OrderCertificateApplication, constraint)
            break

    schema_editor.remove_field(
        OrderCertificateApplication,
        OrderCertificateApplication._meta.get_field("order"),
    )


class Migration(migrations.Migration):
    """
    Нужна для merge-миграции 0044_merge_... на сервере.
    Меняет только БД со старой схемой (order_id); state не трогает.
    """

    dependencies = [
        ("shop", "0042_order_certificate_application"),
    ]

    operations = [
        migrations.RunPython(upgrade_offline_schema, migrations.RunPython.noop),
    ]
