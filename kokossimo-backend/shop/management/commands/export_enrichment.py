"""
Экспорт обогащённых данных (описание + подкатегория) для переноса на сервер.

Локально: после sync_moysklad_site_products с OpenAI обогащением запустите
  python manage.py export_enrichment -o enrichment.json

Загрузите enrichment.json на сервер и там:
  python manage.py import_enrichment enrichment.json

Совпадение товаров по moysklad_id (он одинаков после синка с МойСклад).
"""
import json

from django.core.management.base import BaseCommand

from shop.models import Product


class Command(BaseCommand):
    help = "Экспорт описаний и подкатегорий товаров в JSON для импорта на сервере (обход блокировки OpenAI по региону)."

    def add_arguments(self, parser):
        parser.add_argument(
            "-o", "--output",
            type=str,
            default="enrichment.json",
            help="Путь к выходному JSON-файлу (по умолчанию enrichment.json)",
        )

    def handle(self, *args, **options):
        out_path = options["output"]

        products = Product.objects.filter(
            moysklad_id__isnull=False
        ).exclude(
            moysklad_id=""
        ).select_related("product_subcategory")

        rows = []
        for p in products:
            if not p.description and not p.product_subcategory_id:
                continue
            rows.append({
                "moysklad_id": p.moysklad_id,
                "description": (p.description or "").strip(),
                "product_subcategory_code": p.product_subcategory.code if p.product_subcategory_id else None,
            })

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)

        self.stdout.write(
            self.style.SUCCESS(f"Экспортировано {len(rows)} товаров в {out_path}")
        )
        self.stdout.write(
            "Перенесите файл на сервер и выполните: python manage.py import_enrichment " + out_path
        )
