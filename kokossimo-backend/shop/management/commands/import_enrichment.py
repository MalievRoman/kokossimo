"""
Импорт обогащённых данных (описание + подкатегория) с локальной машины.

На сервере после синка из МойСклад (без OpenAI) запустите:
  python manage.py import_enrichment enrichment.json

Файл enrichment.json создаётся локально командой export_enrichment после
sync_moysklad_site_products с работающим OpenAI.
"""
import json

from django.core.management.base import BaseCommand

from shop.models import Product, ProductSubcategory


class Command(BaseCommand):
    help = "Импорт описаний и подкатегорий из JSON (экспорт с локальной машины после обогащения OpenAI)."

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            type=str,
            help="Путь к JSON-файлу (результат export_enrichment)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать, что будет обновлено, без записи в БД",
        )

    def handle(self, *args, **options):
        path = options["file"]
        dry_run = options["dry_run"]

        try:
            with open(path, "r", encoding="utf-8") as f:
                rows = json.load(f)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f"Файл не найден: {path}"))
            return
        except json.JSONDecodeError as e:
            self.stdout.write(self.style.ERROR(f"Ошибка JSON: {e}"))
            return

        if not isinstance(rows, list):
            self.stdout.write(self.style.ERROR("Ожидается JSON-массив объектов."))
            return

        codes = {r.get("product_subcategory_code") for r in rows if r.get("product_subcategory_code")}
        subcats = {s.code: s for s in ProductSubcategory.objects.filter(code__in=codes)}
        missing_codes = codes - set(subcats.keys())
        if missing_codes:
            self.stdout.write(
                self.style.WARNING(f"В БД нет подкатегорий с кодами: {missing_codes}")
            )

        updated = 0
        skipped = 0
        for row in rows:
            moysklad_id = row.get("moysklad_id")
            if not moysklad_id:
                skipped += 1
                continue
            product = Product.objects.filter(moysklad_id=moysklad_id).first()
            if not product:
                skipped += 1
                continue

            update_fields = []
            if "description" in row and row["description"]:
                product.description = row["description"]
                update_fields.append("description")
            code = row.get("product_subcategory_code")
            if code and code in subcats:
                product.product_subcategory = subcats[code]
                update_fields.append("product_subcategory")
            elif code and not subcats.get(code):
                pass

            if update_fields and not dry_run:
                product.save(update_fields=update_fields)
                updated += 1
            elif update_fields:
                updated += 1

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f"Dry-run: было бы обновлено {updated} товаров, пропущено {skipped}.")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Обновлено {updated} товаров, пропущено {skipped}.")
            )
