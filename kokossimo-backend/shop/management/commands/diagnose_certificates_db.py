from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connections

from staff_portal.certificates_db import (
    _certificates_columns,
    certificates_connection_label,
    certificates_db_ready,
    certificates_orm_error,
    certificates_table_exists,
)


class Command(BaseCommand):
    help = "Показать подключение certificates и наличие таблицы."

    def handle(self, *args, **options):
        default = settings.DATABASES.get("default", {})
        self.stdout.write("=== default (магазин) ===")
        self.stdout.write(f"Engine: {default.get('ENGINE', '')}")
        self.stdout.write(f"Name: {default.get('NAME', '')}")

        self.stdout.write("")
        self.stdout.write("=== certificates ===")
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
