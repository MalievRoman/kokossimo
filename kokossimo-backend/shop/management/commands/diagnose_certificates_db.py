from django.core.management.base import BaseCommand
from django.db import connections

from staff_portal.certificates_db import (
    certificates_connection_label,
    certificates_table_exists,
)


class Command(BaseCommand):
    help = "Показать, к какой БД подключён alias certificates и есть ли таблица."

    def handle(self, *args, **options):
        conn = connections["certificates"]
        self.stdout.write(f"Alias: certificates")
        self.stdout.write(f"Engine: {conn.settings_dict['ENGINE']}")
        self.stdout.write(f"Target: {certificates_connection_label()}")
        self.stdout.write(
            f"Table certificates exists: {certificates_table_exists()}"
        )
