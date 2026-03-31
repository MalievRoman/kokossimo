from django.core.management.base import BaseCommand, CommandError

from shop.moysklad import MoySkladError, MoySkladConfigError
from shop.moysklad_sync import sync_product_stocks


class Command(BaseCommand):
    help = "Синхронизирует только остатки товаров из МойСклад в локальную БД."

    def handle(self, *args, **options):
        self.stdout.write("Запуск синхронизации остатков из МойСклад...")

        def progress(message):
            self.stdout.write(f"[stocks] {message}")

        try:
            stats = sync_product_stocks(
                progress_callback=progress,
                sync_source="management_command",
                initiated_by="sync_moysklad_stocks",
            )
        except (MoySkladConfigError, MoySkladError) as exc:
            raise CommandError(str(exc))

        self.stdout.write(
            self.style.SUCCESS(
                "Готово: "
                f"обработано {stats.get('processed', 0)}, "
                f"обновлено {stats.get('updated', 0)}, "
                f"без изменений {stats.get('unchanged', 0)}, "
                f"не найдено в МойСклад {stats.get('missing', 0)}, "
                f"ошибок {stats.get('errors', 0)}."
            )
        )
