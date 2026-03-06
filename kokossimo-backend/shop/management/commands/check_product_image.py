"""
Диагностика загрузки изображений товаров из МойСклад.
Запуск: python manage.py check_product_image [product_id]
Если product_id не указан — проверяется первый товар с moysklad_id.
"""
from django.core.management.base import BaseCommand

from shop.models import Product
from shop.moysklad import MoySkladClient, MoySkladError, MoySkladConfigError


class Command(BaseCommand):
    help = "Проверяет, почему не загружается изображение товара из МойСклад (пошаговая диагностика)."

    def add_arguments(self, parser):
        parser.add_argument(
            "product_id",
            nargs="?",
            type=int,
            help="ID товара в вашей БД (если не указан — первый товар с moysklad_id)",
        )

    def handle(self, *args, **options):
        product_id = options.get("product_id")
        if product_id:
            product = Product.objects.filter(id=product_id).first()
            if not product:
                self.stdout.write(self.style.ERROR(f"Товар с id={product_id} не найден."))
                return
        else:
            product = Product.objects.filter(moysklad_id__isnull=False).exclude(moysklad_id="").first()
            if not product:
                self.stdout.write(
                    self.style.ERROR("В БД нет товаров с moysklad_id. Запустите sync_moysklad_site_products.")
                )
                return
            product_id = product.id

        self.stdout.write(f"\n--- Проверка товара id={product_id}, name={product.name!r} ---\n")

        # 1. Данные в БД
        self.stdout.write("1. Данные в БД:")
        self.stdout.write(f"   moysklad_id: {getattr(product, 'moysklad_id', None)!r}")
        self.stdout.write(f"   external_image_url: {bool(product.external_image_url)}")
        if product.external_image_url:
            url = product.external_image_url
            self.stdout.write(f"   URL (первые 80 символов): {url[:80]!r}...")
        else:
            self.stdout.write(self.style.WARNING("   У товара нет external_image_url — синк не сохранил ссылку на картинку."))
            self.stdout.write("   Решение: перезапустите sync_moysklad_site_products и проверьте, что в МойСклад у товара есть изображения.\n")
            return

        # 2. Подключение к API
        self.stdout.write("\n2. Подключение к API МойСклад:")
        try:
            client = MoySkladClient()
            self.stdout.write(self.style.SUCCESS("   Клиент создан (токен/логин заданы)."))
        except MoySkladConfigError as e:
            self.stdout.write(self.style.ERROR(f"   Ошибка: {e}"))
            self.stdout.write("   Проверьте в .env: MOYSKLAD_TOKEN или MOYSKLAD_LOGIN + MOYSKLAD_PASSWORD.\n")
            return

        # 3. Запрос товара из ассортимента
        self.stdout.write("\n3. Запрос товара из ассортимента (get_assortment_item):")
        try:
            row = client.get_assortment_item(product.moysklad_id)
        except MoySkladError as e:
            self.stdout.write(self.style.ERROR(f"   Ошибка API: {e}"))
            self.stdout.write("   Проверьте доступ к api.moysklad.ru и корректность moysklad_id.\n")
            return

        if not row:
            self.stdout.write(self.style.ERROR("   Товар не найден в ассортименте МойСклад (пустой ответ)."))
            return

        self.stdout.write("   Ответ получен.")
        self.stdout.write(f"   Ключи в ответе: {list(row.keys())}")

        images_data = row.get("images") or {}
        self.stdout.write(f"   images в ответе: type={type(images_data).__name__}")
        if isinstance(images_data, dict):
            self.stdout.write(f"   images.meta: {bool(images_data.get('meta'))}")
            self.stdout.write(f"   images.rows: {len(images_data.get('rows') or [])} шт.")
        elif isinstance(images_data, list):
            self.stdout.write(f"   images (список): {len(images_data)} шт.")

        # 4. Кандидаты URL для скачивания (как в прокси)
        self.stdout.write("\n4. Поиск ссылок на изображения (downloadHref):")
        candidates = []
        if isinstance(images_data, list):
            for i, item in enumerate(images_data):
                meta = (item or {}).get("meta") or {}
                mini = (item or {}).get("miniature") or {}
                dh = meta.get("downloadHref")
                if not dh and meta.get("href"):
                    try:
                        full = client.get_image_by_href(meta.get("href"))
                        dh = (full.get("meta") or {}).get("downloadHref")
                    except Exception as ex:
                        self.stdout.write(f"   get_image_by_href: {ex}")
                if dh:
                    candidates.append(("original", dh))
                if mini.get("downloadHref"):
                    candidates.append(("miniature", mini.get("downloadHref")))
        else:
            rows = images_data.get("rows") or []
            for r in rows:
                meta = (r or {}).get("meta") or {}
                mini = (r or {}).get("miniature") or {}
                dh = meta.get("downloadHref")
                if not dh and meta.get("href"):
                    try:
                        full = client.get_image_by_href(meta.get("href"))
                        dh = (full.get("meta") or {}).get("downloadHref")
                    except Exception as ex:
                        self.stdout.write(f"   get_image_by_href: {ex}")
                if dh:
                    candidates.append(("original", dh))
                if mini.get("downloadHref"):
                    candidates.append(("miniature", mini.get("downloadHref")))
            if not candidates and images_data.get("meta", {}).get("href"):
                try:
                    fetched = client.get_images_rows_from_meta(images_data["meta"], limit=5)
                    for r in fetched:
                        meta = (r or {}).get("meta") or {}
                        if meta.get("downloadHref"):
                            candidates.append(("from_meta", meta.get("downloadHref")))
                except Exception as ex:
                    self.stdout.write(f"   get_images_rows_from_meta: {ex}")
            if not candidates and row.get("product", {}).get("meta", {}).get("href"):
                try:
                    prod = client.get_entity_by_href(row["product"]["meta"]["href"], expand="images")
                    im = (prod or {}).get("images") or {}
                    for r in (im.get("rows") or [])[:3]:
                        meta = (r or {}).get("meta") or {}
                        if meta.get("downloadHref"):
                            candidates.append(("product_entity", meta.get("downloadHref")))
                except Exception as ex:
                    self.stdout.write(f"   get_entity_by_href(product): {ex}")

        if not candidates:
            self.stdout.write(self.style.WARNING("   Кандидатов нет — в ответе API нет downloadHref для изображений."))
            self.stdout.write("   Убедитесь, что в МойСклад у этого товара загружено хотя бы одно изображение.\n")
            return

        self.stdout.write(f"   Найдено кандидатов: {len(candidates)}")
        for kind, url in candidates[:3]:
            self.stdout.write(f"   - {kind}: {url[:70]}...")

        # 5. Попытка скачать
        self.stdout.write("\n5. Скачивание изображения:")
        for kind, url in candidates:
            try:
                payload, content_type = client.download_binary(url)
                self.stdout.write(self.style.SUCCESS(f"   Успех ({kind}): {len(payload)} байт, Content-Type: {content_type}"))
                self.stdout.write("   Итог: изображение можно загрузить. Если на сайте всё ещё показывается плейсхолдер — проверьте логи runserver при запросе /api/products/<id>/image/.\n")
                return
            except MoySkladError as e:
                self.stdout.write(self.style.ERROR(f"   Ошибка ({kind}): {e}"))

        self.stdout.write("")
        self.stdout.write(self.style.ERROR("   Все кандидаты не удалось скачать."))
        self.stdout.write("   Возможные причины: блокировка порта 8080, истёкшая подпись URL, сетевая ошибка до хранилища МойСклад.")
        self.stdout.write("   Проверьте с сервера: доступ к api.moysklad.ru и к домену хранилища (storage.*), файрвол.\n")
