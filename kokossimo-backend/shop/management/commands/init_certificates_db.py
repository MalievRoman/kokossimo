"""
Создаёт таблицы certificates и certificate_transactions в БД certificates (SQLite).
Нужно, если нет PostgreSQL и файл certificates.sqlite3 пустой.

Запуск: python manage.py init_certificates_db
"""

from django.core.management.base import BaseCommand
from django.db import connections


_SQLITE_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS certificates (
        id varchar(16) NOT NULL PRIMARY KEY,
        status varchar(50) NOT NULL DEFAULT 'created',
        currency varchar(3) NOT NULL DEFAULT 'RUB',
        initial_amount decimal NULL,
        current_balance decimal NULL,
        expires_at datetime NULL,
        created_at datetime NOT NULL,
        updated_at datetime NOT NULL,
        created_by integer NULL,
        owner_customer_id integer NULL,
        source_channel integer NULL,
        metadata text NOT NULL DEFAULT '{}'
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS certificate_transactions (
        id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
        certificate_id varchar(16) NULL,
        type varchar(50) NULL,
        amount decimal NULL,
        balance_before decimal NULL,
        balance_after decimal NULL,
        currency varchar(3) NOT NULL DEFAULT 'RUB',
        order_id integer NULL,
        payment_id integer NULL,
        store_id integer NULL,
        cash_register_id integer NULL,
        channel integer NULL,
        performed_by integer NULL,
        reason varchar(200) NULL,
        idempotency_key varchar(255) NOT NULL,
        created_at datetime NOT NULL,
        metadata text NOT NULL DEFAULT '{}'
    )
    """,
)


class Command(BaseCommand):
    help = "Создаёт таблицы сертификатов в БД certificates (для SQLite без PostgreSQL)."

    def handle(self, *args, **options):
        connection = connections["certificates"]
        engine = connection.settings_dict.get("ENGINE", "")

        if "sqlite" not in engine:
            self.stdout.write(
                self.style.WARNING(
                    "БД certificates — не SQLite. Таблицы создаются в PostgreSQL вручную. "
                    "Проверьте CERTIFICATES_POSTGRES_* в .env."
                )
            )
            return

        db_path = connection.settings_dict.get("NAME")
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='certificates'"
            )
            if cursor.fetchone():
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Таблица certificates уже есть в {db_path}"
                    )
                )
                return

            for statement in _SQLITE_STATEMENTS:
                cursor.execute(statement)

        self.stdout.write(
            self.style.SUCCESS(
                f"Таблицы certificates и certificate_transactions созданы в {db_path}"
            )
        )
