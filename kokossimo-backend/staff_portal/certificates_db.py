from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError

from shop.models import Certificate

_REQUIRED_CERTIFICATE_COLUMNS = frozenset(
    {
        "id",
        "status",
        "currency",
        "initial_amount",
        "current_balance",
        "expires_at",
        "created_at",
        "updated_at",
    }
)


def certificates_connection_label() -> str:
    db = settings.DATABASES.get("certificates", {})
    engine = db.get("ENGINE", "")
    if engine.endswith("postgresql"):
        return (
            f"PostgreSQL {db.get('HOST', 'localhost')}:{db.get('PORT', '5432')}"
            f"/{db.get('NAME', '')}"
        )
    return f"SQLite {db.get('NAME', '')}"


def _certificates_connection():
    return connections["certificates"]


def _certificates_table_names() -> set[str]:
    names = _certificates_connection().introspection.table_names()
    return {name.lower() for name in names}


def certificates_table_exists() -> bool:
    """Таблица есть в каталоге БД (без запроса через ORM)."""
    connection = _certificates_connection()
    if connection.vendor == "sqlite":
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='certificates'"
            )
            return cursor.fetchone() is not None
    return "certificates" in _certificates_table_names()


def _certificates_columns() -> set[str] | None:
    connection = _certificates_connection()
    table = Certificate._meta.db_table
    try:
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
    except (OperationalError, ProgrammingError):
        return None


def certificates_orm_error() -> str | None:
    """Ошибка доступа к таблице через ORM; None — запрос прошёл."""
    if not certificates_table_exists():
        return None
    try:
        Certificate.objects.using("certificates").exists()
    except (OperationalError, ProgrammingError) as exc:
        return str(exc).strip() or exc.__class__.__name__
    return None


def certificates_db_ready() -> tuple[bool, str | None]:
    if not certificates_table_exists():
        return False, certificates_database_error_message(missing_table=True)
    columns = _certificates_columns()
    if columns is not None and not _REQUIRED_CERTIFICATE_COLUMNS.issubset(columns):
        missing = ", ".join(sorted(_REQUIRED_CERTIFICATE_COLUMNS - columns))
        return False, certificates_schema_error_message(
            f"в таблице certificates нет колонок: {missing}"
        )
    orm_error = certificates_orm_error()
    if orm_error:
        return False, certificates_schema_error_message(orm_error)
    return True, None


def certificates_schema_error_message(detail: str) -> str:
    label = certificates_connection_label()
    return (
        f"Подключение «certificates»: {label}. "
        f"Таблица certificates найдена, но схема не совпадает с приложением ({detail}). "
        "Обновите DDL в PostgreSQL под текущую модель Certificate."
    )


def certificates_database_error_message(*, missing_table: bool = True) -> str:
    label = certificates_connection_label()
    if settings.DATABASES.get("certificates", {}).get("ENGINE", "").endswith("postgresql"):
        if missing_table:
            tables = sorted(_certificates_table_names())[:12]
            hint = ""
            if tables:
                hint = f" В этой БД есть таблицы: {', '.join(tables)}."
            return (
                f"Подключение «certificates»: {label}. "
                "Таблица certificates не найдена в этой базе."
                f"{hint} "
                "Если таблица в другой базе PostgreSQL, задайте CERTIFICATES_POSTGRES_DB "
                "в .env и перезапустите gunicorn. "
                "Диагностика: python manage.py diagnose_certificates_db"
            )
        return (
            f"Подключение «certificates»: {label}. "
            "БД недоступна. Проверьте CERTIFICATES_POSTGRES_* / POSTGRES_* в .env."
        )
    return (
        f"Подключение «certificates»: {label} — локальный SQLite, а не PostgreSQL на сервере. "
        "Задайте POSTGRES_DB (та же БД, что у магазина) или CERTIFICATES_POSTGRES_DB "
        "в .env и перезапустите gunicorn. Либо: python manage.py init_certificates_db"
    )
