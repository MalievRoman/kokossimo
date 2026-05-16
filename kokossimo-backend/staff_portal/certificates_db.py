from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError

from shop.models import Certificate


def certificates_database_path() -> str:
    db = settings.DATABASES.get("certificates", {})
    return str(db.get("NAME", ""))


def certificates_table_exists() -> bool:
    connection = connections["certificates"]
    if connection.vendor == "sqlite":
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='certificates'"
            )
            return cursor.fetchone() is not None
    try:
        Certificate.objects.using("certificates").exists()
    except (OperationalError, ProgrammingError):
        return False
    return True


def certificates_database_error_message() -> str:
    path = certificates_database_path()
    if settings.DATABASES.get("certificates", {}).get("ENGINE", "").endswith("postgresql"):
        return (
            "БД сертификатов (PostgreSQL) недоступна или в ней нет таблицы certificates. "
            "Проверьте переменные CERTIFICATES_POSTGRES_* в .env и доступ к серверу."
        )
    return (
        "В файле certificates.sqlite3 нет таблицы certificates. "
        f"Путь: {path}. Выполните: python manage.py init_certificates_db"
    )
