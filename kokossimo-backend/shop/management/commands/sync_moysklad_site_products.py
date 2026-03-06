from django.core.management.base import BaseCommand, CommandError

from shop.moysklad import MoySkladError, MoySkladConfigError
from shop.moysklad_sync import sync_site_products


class Command(BaseCommand):
    help = "Синхронизирует товары сайта из МойСклад в локальную БД (включая ссылки на изображения)."

    def handle(self, *args, **options):
        self.stdout.write("Запуск синхронизации товаров из МойСклад...")

        def progress(message):
            self.stdout.write(f"[sync] {message}")

        try:
            stats = sync_site_products(force=True, progress_callback=progress)
        except (MoySkladConfigError, MoySkladError) as exc:
            raise CommandError(str(exc))

        if stats.get("skipped"):
            self.stdout.write(self.style.WARNING("Синхронизация пропущена по интервалу."))
            return

        if stats.get("prepared_rows", 0) == 0:
            self.stdout.write(
                self.style.WARNING(
                    "По фильтру категории не найдено ни одного товара.\n"
                    f"Текущая категория: {stats.get('target_category_name', '-')}"
                )
            )
            sample_paths = stats.get("sample_paths") or []
            sample_folders = stats.get("sample_folder_names") or []
            sample_folder_ids = stats.get("sample_folder_ids") or []
            sample_folder_payloads = stats.get("sample_product_folder_payloads") or []
            if sample_paths:
                self.stdout.write("Примеры pathName из МойСклад:")
                for value in sample_paths:
                    self.stdout.write(f"  - {value}")
            if sample_folders:
                self.stdout.write("Примеры productFolder.name из МойСклад:")
                for value in sample_folders:
                    self.stdout.write(f"  - {value}")
            if sample_folder_ids:
                self.stdout.write("Примеры извлеченных productFolder ID:")
                for value in sample_folder_ids:
                    self.stdout.write(f"  - {value}")
            if sample_folder_payloads:
                self.stdout.write("Примеры productFolder payload (debug):")
                for value in sample_folder_payloads:
                    self.stdout.write(f"  - {value}")

        self.stdout.write(
            self.style.SUCCESS(
                "Готово: "
                f"создано {stats.get('created', 0)}, "
                f"обновлено {stats.get('updated', 0)}, "
                f"подготовлено {stats.get('prepared_rows', 0)} из {stats.get('processed_rows', 0)} строк, "
                f"отфильтровано {stats.get('filtered_out', 0)}, "
                f"пропущено без id/названия {stats.get('skipped_no_id_or_name', 0)}, с нулевой ценой {stats.get('skipped_zero_price', 0)}, "
                f"удалено {stats.get('deleted', 0)}."
            )
        )
