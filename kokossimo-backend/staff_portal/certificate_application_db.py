from django.db import connection

from shop.models import OrderCertificateApplication

_REQUIRED_COLUMNS = frozenset(
    {
        "id",
        "certificate_id",
        "purchase_total",
        "amount",
        "currency",
        "status",
    }
)


def _table_columns(table: str) -> set[str]:
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


def certificate_application_table_status() -> str:
    """
    ready — таблица есть и схема актуальна;
    missing — таблицы нет;
    outdated — таблица есть, но не хватает колонок (нужен migrate).
    """
    table = OrderCertificateApplication._meta.db_table
    if table not in connection.introspection.table_names():
        return "missing"

    columns = _table_columns(table)
    if _REQUIRED_COLUMNS.issubset(columns):
        return "ready"
    return "outdated"


def certificate_application_db_error_message(status: str) -> str:
    if status == "missing":
        return (
            "Таблица применений сертификатов не создана. "
            "На сервере выполните: python manage.py migrate shop"
        )
    if status == "outdated":
        return (
            "Схема таблицы применений сертификатов устарела. "
            "Выполните: python manage.py migrate shop"
        )
    return "Ошибка базы данных при работе с применениями сертификатов."
