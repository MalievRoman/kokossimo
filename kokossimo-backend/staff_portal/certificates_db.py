from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError

from shop.models import Certificate


def certificates_connection_label() -> str:
    db = settings.DATABASES.get("certificates", {})
    engine = db.get("ENGINE", "")
    if engine.endswith("postgresql"):
        return (
            f"PostgreSQL {db.get('HOST', 'localhost')}:{db.get('PORT', '5432')}"
            f"/{db.get('NAME', '')}"
        )
    return f"SQLite {db.get('NAME', '')}"


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
    label = certificates_connection_label()
    if settings.DATABASES.get("certificates", {}).get("ENGINE", "").endswith("postgresql"):
        return (
            f"Подключение «certificates»: {label}. "
            "Таблица certificates не найдена или БД недоступна. "
            "Если таблица в другой базе PostgreSQL, задайте CERTIFICATES_POSTGRES_DB "
            "и перезапустите gunicorn."
        )
    return (
        f"Подключение «certificates»: {label} — локальный SQLite, а не PostgreSQL на сервере. "
        "Задайте POSTGRES_DB (та же БД, что у магазина) или CERTIFICATES_POSTGRES_DB "
        "в .env и перезапустите gunicorn. Либо: python manage.py init_certificates_db"
    )
