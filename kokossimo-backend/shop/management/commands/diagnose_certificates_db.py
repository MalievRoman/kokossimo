from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connections

from staff_portal.certificate_application_db import certificate_application_table_status
from staff_portal.certificates_db import (
    _certificates_columns,
    _certificates_table_names,
    certificates_connection_label,
    certificates_db_ready,
    certificates_orm_error,
    certificates_table_exists,
)
from shop.models import OrderCertificateApplication


class Command(BaseCommand):
    help = "Показать подключения БД, таблицы сертификатов и статус миграций."

    def handle(self, *args, **options):
        default = settings.DATABASES.get("default", {})
        self.stdout.write("=== default (магазин, применения) ===")
        self.stdout.write(f"Engine: {default.get('ENGINE', '')}")
        self.stdout.write(f"Name: {default.get('NAME', '')}")
        app_table = OrderCertificateApplication._meta.db_table
        self.stdout.write(f"Table {app_table}: {certificate_application_table_status()}")
        if certificate_application_table_status() != "ready":
            self.stdout.write(
                self.style.WARNING("  → python manage.py migrate shop")
            )

        self.stdout.write("")
        self.stdout.write("=== certificates (сертификаты) ===")
        conn = connections["certificates"]
        self.stdout.write(f"Engine: {conn.settings_dict['ENGINE']}")
        self.stdout.write(f"Target: {certificates_connection_label()}")
        self.stdout.write(
            f"Table certificates in catalog: {certificates_table_exists()}"
        )
        columns = _certificates_columns()
        if columns is not None:
            self.stdout.write(f"Columns ({len(columns)}): {', '.join(sorted(columns))}")
        orm_error = certificates_orm_error()
        if orm_error:
            self.stdout.write(self.style.ERROR(f"ORM error: {orm_error}"))
        ready, message = certificates_db_ready()
        style = self.style.SUCCESS if ready else self.style.ERROR
        self.stdout.write(style(f"Ready for staff portal: {ready}"))
        if message:
            self.stdout.write(message)

        tables = sorted(_certificates_table_names())
        if tables and not certificates_table_exists():
            preview = ", ".join(tables[:20])
            suffix = "…" if len(tables) > 20 else ""
            self.stdout.write(f"Tables in this DB: {preview}{suffix}")
