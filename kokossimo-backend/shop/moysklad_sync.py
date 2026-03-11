from datetime import timedelta
from decimal import Decimal
import json
import logging
from urllib.parse import urlparse

from django.conf import settings
from django.utils import timezone

from .models import Category, Product
from .moysklad import MoySkladClient
from .openai_categorize import enrich_product, needs_description, needs_category


_last_sync_at = None
_last_sync_attempt_at = None
_last_sync_failed = False
logger = logging.getLogger(__name__)


def _normalize(value):
    if not value:
        return ""
    return " ".join(str(value).strip().lower().replace("ё", "е").split())


def _extract_id_from_href(href):
    if not href:
        return ""
    path = urlparse(str(href)).path
    return path.rstrip("/").split("/")[-1]


def _extract_folder_id_from_row(row):
    product_folder = row.get("productFolder") or {}
    folder_meta = (product_folder.get("meta") or {})
    href = (
        folder_meta.get("href")
        or folder_meta.get("metadataHref")
        or product_folder.get("href")
        or ""
    )
    if href:
        return _extract_id_from_href(href)
    direct_id = (product_folder.get("id") or "").strip()
    if direct_id:
        return direct_id

    # Дополнительный fallback: в некоторых типах assortment папка может называться иначе.
    folder_alt = row.get("folder") or {}
    folder_alt_meta = (folder_alt.get("meta") or {})
    href_alt = (
        folder_alt_meta.get("href")
        or folder_alt_meta.get("metadataHref")
        or folder_alt.get("href")
        or ""
    )
    if href_alt:
        return _extract_id_from_href(href_alt)
    direct_alt_id = (folder_alt.get("id") or "").strip()
    if direct_alt_id:
        return direct_alt_id

    return ""

def _row_matches_target_name(row, target_name):
    target = _normalize(target_name)
    if not target:
        return False

    path_name = _normalize(row.get("pathName", ""))
    folder_name = _normalize((row.get("productFolder") or {}).get("name", ""))

    return target in path_name or target == folder_name or target in folder_name


def _build_allowed_folder_ids(folders, target_name, target_folder_id="", target_external_code=""):
    target_norm = _normalize(target_name)
    target_folder_id = (target_folder_id or "").strip()
    target_external_code = _normalize(target_external_code)
    folder_by_id = {}
    children_map = {}
    candidates = []

    for folder in folders:
        folder_id = folder.get("id")
        if not folder_id:
            continue
        folder_by_id[folder_id] = folder
        parent = folder.get("productFolder") or {}
        parent_meta = (parent.get("meta") or {})
        parent_href = parent_meta.get("href") or parent_meta.get("metadataHref") or parent.get("href") or ""
        parent_id = _extract_id_from_href(parent_href)
        if not parent_id:
            parent_id = (parent.get("id") or "").strip()
        children_map.setdefault(parent_id, set()).add(folder_id)

        if target_folder_id and folder_id == target_folder_id:
            candidates.append(folder_id)
            continue

        folder_external_code = _normalize(folder.get("externalCode"))
        if target_external_code and folder_external_code == target_external_code:
            candidates.append(folder_id)
            continue

        name_norm = _normalize(folder.get("name"))
        path_norm = _normalize(folder.get("pathName"))
        if name_norm == target_norm:
            candidates.append(folder_id)
            continue
        if target_norm and path_norm:
            path_parts = [part.strip() for part in path_norm.split("/") if part.strip()]
            if target_norm in path_parts:
                candidates.append(folder_id)

    if not candidates:
        return set()

    candidates = list(dict.fromkeys(candidates))

    # Бывает несколько папок с одинаковым именем в разных ветках.
    # Для строгого отбора берем объединение всех подходящих веток.
    union_allowed = set()
    for root_id in candidates:
        root_folder = folder_by_id.get(root_id) or {}
        root_path = _normalize(root_folder.get("pathName", ""))

        allowed = {root_id}
        stack = [root_id]
        while stack:
            current = stack.pop()
            for child_id in children_map.get(current, set()):
                if child_id not in allowed:
                    allowed.add(child_id)
                    stack.append(child_id)

        # Fallback: если parent-link в ответе неполный, расширяем по pathName.
        if root_path:
            prefix = f"{root_path}/"
            for folder in folders:
                folder_id = folder.get("id")
                if not folder_id:
                    continue
                folder_path = _normalize(folder.get("pathName", ""))
                if folder_path == root_path or folder_path.startswith(prefix):
                    allowed.add(folder_id)

        union_allowed.update(allowed)

    return union_allowed


def _resolve_target_folder_id(folders, target_name, target_folder_id="", target_external_code=""):
    target_folder_id = (target_folder_id or "").strip()
    if target_folder_id:
        return target_folder_id

    target_external_code = _normalize(target_external_code)
    target_name_norm = _normalize(target_name)
    for folder in folders:
        folder_id = (folder.get("id") or "").strip()
        if not folder_id:
            continue
        if target_external_code and _normalize(folder.get("externalCode")) == target_external_code:
            return folder_id
    for folder in folders:
        folder_id = (folder.get("id") or "").strip()
        if not folder_id:
            continue
        if _normalize(folder.get("name")) == target_name_norm:
            return folder_id
    return ""


def _extract_price(row):
    sale_prices = row.get("salePrices") or []
    if not sale_prices:
        return Decimal("0.00")

    raw_value = sale_prices[0].get("value")
    if raw_value is None:
        return Decimal("0.00")

    try:
        return (Decimal(str(raw_value)) / Decimal("100")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _get_original_image_url(image_obj, client):
    """Из объекта изображения возвращает URL исходного изображения (original).
    При отсутствии meta.downloadHref подгружает сущность по meta.href; fallback — миниатюра.
    """
    if not image_obj or not client:
        return ""
    meta = (image_obj.get("meta") or {})
    miniature = (image_obj.get("miniature") or {})
    download_href = meta.get("downloadHref")
    if download_href:
        return download_href
    meta_href = meta.get("href")
    if meta_href:
        try:
            full_image = client.get_image_by_href(meta_href)
            full_meta = (full_image.get("meta") or {})
            if full_meta.get("downloadHref"):
                return full_meta.get("downloadHref")
        except Exception:
            pass
    return miniature.get("downloadHref") or ""


def _extract_image_url(row, client, allow_meta_fetch=False):
    images_data = row.get("images") or {}
    if isinstance(images_data, list) and images_data:
        first = images_data[0] or {}
        url = _get_original_image_url(first, client)
        if url:
            return url

    rows = images_data.get("rows") or []
    if rows:
        return _get_original_image_url(rows[0], client)

    images_meta = images_data.get("meta") or {}
    if allow_meta_fetch and images_meta:
        try:
            fetched_rows = client.get_images_rows_from_meta(images_meta, limit=1)
        except Exception:
            return ""
        if fetched_rows:
            return _get_original_image_url(fetched_rows[0], client)

    return ""


def _should_sync():
    global _last_sync_at, _last_sync_attempt_at, _last_sync_failed

    interval_seconds = int(getattr(settings, "MOYSKLAD_SYNC_INTERVAL_SECONDS", 300))
    retry_interval_seconds = int(getattr(settings, "MOYSKLAD_SYNC_RETRY_INTERVAL_SECONDS", 120))
    now = timezone.now()

    if _last_sync_failed and _last_sync_attempt_at is not None:
        return now - _last_sync_attempt_at >= timedelta(seconds=max(10, retry_interval_seconds))

    if interval_seconds <= 0:
        return True
    if _last_sync_at is None:
        return True
    return now - _last_sync_at >= timedelta(seconds=interval_seconds)


def sync_site_products(force=False, progress_callback=None):
    global _last_sync_at, _last_sync_attempt_at, _last_sync_failed

    def _progress(message):
        if progress_callback:
            progress_callback(message)

    if not force and not _should_sync():
        _progress("Синхронизация пропущена: сработал интервал защиты от частых запусков.")
        return {
            "skipped": True,
            "processed_pages": 0,
            "processed_rows": 0,
            "prepared_rows": 0,
            "created": 0,
            "updated": 0,
            "deleted": 0,
            "categorized": 0,
            "categorize_skipped": 0,
            "descriptions_generated": 0,
            "descriptions_skipped": 0,
        }
    _last_sync_attempt_at = timezone.now()

    category_name = getattr(settings, "MOYSKLAD_SITE_CATEGORY_NAME", "САЙТ КОКОССИМО")
    category_slug = getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo")
    category_folder_id = (getattr(settings, "MOYSKLAD_SITE_CATEGORY_ID", "") or "").strip()
    category_external_code = (getattr(settings, "MOYSKLAD_SITE_CATEGORY_EXTERNAL_CODE", "") or "").strip()
    _progress(f"Старт синка категории: {category_name}")
    if category_folder_id:
        _progress(f"Таргет-папка задана по ID: {category_folder_id}")
    elif category_external_code:
        _progress(f"Таргет-папка задана по externalCode: {category_external_code}")

    category, _ = Category.objects.get_or_create(
        slug=category_slug,
        defaults={"name": category_name},
    )
    if category.name != category_name:
        category.name = category_name
        category.save(update_fields=["name"])

    client = MoySkladClient()
    use_folder_tree_filter = bool(getattr(settings, "MOYSKLAD_USE_FOLDER_TREE_FILTER", False))
    relax_folder_filter = bool(getattr(settings, "MOYSKLAD_RELAX_FOLDER_FILTER", True))
    strict_category_only = bool(getattr(settings, "MOYSKLAD_STRICT_CATEGORY_ONLY", True))
    allow_image_meta_fetch = bool(getattr(settings, "MOYSKLAD_IMAGE_META_FETCH", False))
    use_search_filter = bool(getattr(settings, "MOYSKLAD_USE_SEARCH_FILTER", True))
    search_query = (getattr(settings, "MOYSKLAD_SITE_SEARCH_QUERY", "") or "").strip() or category_name
    if use_folder_tree_filter and not use_search_filter:
        # При фильтрации по дереву папок выгоднее сразу сузить выдачу поиском.
        use_search_filter = True
        _progress("Автовключение use_search_filter=true для ускорения и точности фильтра по папкам.")
    if strict_category_only:
        relax_folder_filter = False
        _progress("Строгий режим категории включен: товары берутся только из найденных папок категории.")
    max_pages = int(getattr(settings, "MOYSKLAD_SYNC_MAX_PAGES", 500))
    fail_fast_empty_pages = int(getattr(settings, "MOYSKLAD_FAIL_FAST_EMPTY_PAGES", 5))
    fail_fast_empty_pages = max(0, fail_fast_empty_pages)
    allowed_folder_ids = set()
    trust_search_results = False
    assortment_filter_expr = ""
    stats = {
        "skipped": False,
        "processed_pages": 0,
        "processed_rows": 0,
        "prepared_rows": 0,
        "filtered_out": 0,
        "skipped_no_id_or_name": 0,
        "skipped_zero_price": 0,
        "created": 0,
        "updated": 0,
        "deleted": 0,
        "target_category_name": category_name,
        "sample_paths": [],
        "sample_folder_names": [],
        "sample_folder_ids": [],
        "sample_product_folder_payloads": [],
        "categorized": 0,
        "categorize_skipped": 0,
        "descriptions_generated": 0,
        "descriptions_skipped": 0,
    }

    try:
        if use_folder_tree_filter:
            _progress("Загружаем дерево папок МойСклад...")
            folder_offset = 0
            folder_limit = 100
            all_folders = []
            while True:
                folders_payload = client.get_product_folders(limit=folder_limit, offset=folder_offset)
                folders_rows = folders_payload.get("rows", []) or []
                if not folders_rows:
                    break
                all_folders.extend(folders_rows)
                if len(folders_rows) < folder_limit:
                    break
                folder_offset += folder_limit

            allowed_folder_ids = _build_allowed_folder_ids(
                all_folders,
                category_name,
                target_folder_id=category_folder_id,
                target_external_code=category_external_code,
            )
            resolved_target_folder_id = _resolve_target_folder_id(
                all_folders,
                category_name,
                target_folder_id=category_folder_id,
                target_external_code=category_external_code,
            )
            if not allowed_folder_ids:
                logger.warning("MoySklad folder '%s' not found. Sync result will be empty.", category_name)
                _progress(f"Папка '{category_name}' не найдена в дереве папок.")
            else:
                _progress(f"Найдено {len(allowed_folder_ids)} папок для фильтрации.")
                # Фильтр productFolder=ID возвращает только товары НЕПОСРЕДСТВЕННО в этой папке,
                # без подпапок. Поэтому используем его только когда подпапок нет (одна папка).
                if strict_category_only and resolved_target_folder_id and len(allowed_folder_ids) == 1:
                    assortment_filter_expr = f"productFolder=https://api.moysklad.ru/api/remap/1.2/entity/productfolder/{resolved_target_folder_id}"
                    _progress("Включен серверный фильтр assortment по productFolder (одна папка, без подпапок).")
                elif strict_category_only and len(allowed_folder_ids) > 1:
                    _progress(
                        "Папка категории содержит подпапки: серверный фильтр по productFolder не используем, "
                        "чтобы не терять товары из подпапок. Фильтрация по списку папок (включая вложенные)."
                    )
                    # Не останавливаться по пустым страницам — выборка по search может идти вперемешку.
                    fail_fast_empty_pages = 0
                if (
                    relax_folder_filter
                    and use_search_filter
                    and len(allowed_folder_ids) <= 1
                ):
                    _progress(
                        "Ослабляем фильтр по дереву папок: найдена только корневая папка. "
                        "Используем search-фильтр без жесткого folder ID matching."
                    )
                    allowed_folder_ids = set()
                    trust_search_results = True

        offset = 0
        limit = int(getattr(settings, "MOYSKLAD_SYNC_PAGE_SIZE", 50))
        limit = max(10, min(limit, 100))
        synced_ids = set()
        consecutive_empty_pages = 0
        _progress(
            f"Параметры синка: page_size={limit}, "
            f"use_search_filter={use_search_filter}, search='{search_query}', "
            f"assortment_filter={'on' if assortment_filter_expr else 'off'}."
        )

        while True:
            if stats["processed_pages"] >= max_pages:
                _progress(
                    f"Достигнут лимит страниц ({max_pages}), прерываем синк. "
                    f"Чтобы подгрузить все товары, увеличьте MOYSKLAD_SYNC_MAX_PAGES в .env (сейчас строк: {stats['processed_rows']}, подготовлено: {stats['prepared_rows']})."
                )
                break

            payload = client.get_assortment(
                limit=limit,
                offset=offset,
                search=search_query if use_search_filter else "",
                filter_expr=assortment_filter_expr,
            )
            rows = payload.get("rows", []) or []
            if not rows:
                break
            stats["processed_pages"] += 1
            stats["processed_rows"] += len(rows)

            for row in rows:
                path_name = (row.get("pathName") or "").strip()
                folder_name = ((row.get("productFolder") or {}).get("name") or "").strip()
                folder_id = _extract_folder_id_from_row(row)
                if path_name and path_name not in stats["sample_paths"] and len(stats["sample_paths"]) < 12:
                    stats["sample_paths"].append(path_name)
                if folder_name and folder_name not in stats["sample_folder_names"] and len(stats["sample_folder_names"]) < 12:
                    stats["sample_folder_names"].append(folder_name)
                if folder_id and folder_id not in stats["sample_folder_ids"] and len(stats["sample_folder_ids"]) < 12:
                    stats["sample_folder_ids"].append(folder_id)
                if len(stats["sample_product_folder_payloads"]) < 6:
                    product_folder_payload = row.get("productFolder")
                    if product_folder_payload:
                        try:
                            compact = json.dumps(product_folder_payload, ensure_ascii=False)
                        except Exception:
                            compact = str(product_folder_payload)
                        if compact not in stats["sample_product_folder_payloads"]:
                            stats["sample_product_folder_payloads"].append(compact[:350])
                if (
                    len(stats["sample_paths"]) >= 12
                    and len(stats["sample_folder_names"]) >= 12
                    and len(stats["sample_folder_ids"]) >= 12
                ):
                    break

            prepared_rows = []
            for row in rows:
                folder_id = _extract_folder_id_from_row(row)
                if allowed_folder_ids:
                    if assortment_filter_expr:
                        # Когда сервер уже фильтрует по целевой папке, не дублируем
                        # жесткий фильтр локально (иначе можно потерять вложенные папки).
                        pass
                    # Основной путь: точное совпадение по ID папки.
                    # Fallback: сравнение по path/name, если в строке не пришел productFolder ID.
                    elif folder_id not in allowed_folder_ids and not _row_matches_target_name(row, category_name):
                        stats["filtered_out"] += 1
                        continue
                else:
                    if trust_search_results and use_search_filter:
                        # В этом режиме доверяем серверной выборке МойСклад по search.
                        # Дополнительная локальная проверка по path/name отключена.
                        pass
                    else:
                        if not _row_matches_target_name(row, category_name):
                            stats["filtered_out"] += 1
                            continue

                external_id = row.get("id")
                name = (row.get("name") or "").strip()
                if not external_id or not name:
                    stats["skipped_no_id_or_name"] += 1
                    continue
                max_name_len = Product._meta.get_field("name").max_length
                if len(name) > max_name_len:
                    name = name[: max_name_len - 3] + "..."

                product_price = _extract_price(row)
                if product_price <= 0:
                    stats["skipped_zero_price"] += 1
                    continue

                prepared_rows.append(
                    {
                        "moysklad_id": external_id,
                        "name": name,
                        "description": (row.get("description") or "").strip(),
                        "price": product_price,
                        "external_image_url": _extract_image_url(
                            row, client, allow_meta_fetch=allow_image_meta_fetch
                        ),
                    }
                )
            stats["prepared_rows"] += len(prepared_rows)
            if prepared_rows:
                consecutive_empty_pages = 0
            else:
                consecutive_empty_pages += 1

            if prepared_rows:
                external_ids = [item["moysklad_id"] for item in prepared_rows]
                existing_map = Product.objects.filter(moysklad_id__in=external_ids).in_bulk(
                    field_name="moysklad_id"
                )

                to_create = []
                to_update = []
                for item in prepared_rows:
                    existing = existing_map.get(item["moysklad_id"])
                    if existing is None:
                        to_create.append(
                            Product(
                                moysklad_id=item["moysklad_id"],
                                category=category,
                                name=item["name"],
                                description=item["description"],
                                price=item["price"],
                                external_image_url=item["external_image_url"] or None,
                                image=None,
                                is_bestseller=False,
                                is_new=False,
                                discount=0,
                            )
                        )
                    else:
                        existing.category = category
                        existing.name = item["name"]
                        existing.description = item["description"]
                        existing.price = item["price"]
                        existing.external_image_url = item["external_image_url"] or None
                        existing.image = None
                        # Важно: эти поля редактируются вручную в админке.
                        # Синк должен обновлять данные МойСклада, но не перетирать ручные пометки.
                        to_update.append(existing)

                if to_create:
                    Product.objects.bulk_create(to_create, batch_size=200)
                    stats["created"] += len(to_create)
                if to_update:
                    Product.objects.bulk_update(
                        to_update,
                        [
                            "category",
                            "name",
                            "description",
                            "price",
                            "external_image_url",
                            "image",
                        ],
                        batch_size=200,
                    )
                    stats["updated"] += len(to_update)
                synced_ids.update(external_ids)
            _progress(
                f"Страница {stats['processed_pages']}: получено {len(rows)}, "
                f"к загрузке {len(prepared_rows)}, отфильтровано {stats['filtered_out']}, "
                f"без id/названия {stats['skipped_no_id_or_name']}, нулевая цена {stats['skipped_zero_price']}, "
                f"создано {stats['created']}, обновлено {stats['updated']}."
            )
            if (
                fail_fast_empty_pages > 0
                and stats["prepared_rows"] == 0
                and consecutive_empty_pages >= fail_fast_empty_pages
            ):
                _progress(
                    "Ранний выход: несколько страниц подряд без совпадений "
                    f"({consecutive_empty_pages}). Останавливаем синк для быстрой диагностики."
                )
                break

            if len(rows) < limit:
                break
            offset += limit

        if synced_ids:
            deleted_count, _ = Product.objects.filter(category=category, moysklad_id__isnull=False).exclude(
                moysklad_id__in=synced_ids
            ).delete()
            stats["deleted"] = int(deleted_count)
            _progress(f"Удалено устаревших товаров: {stats['deleted']}.")

        # Один вызов OpenAI на товар: сначала описание, затем категория
        if getattr(settings, "OPENAI_CATEGORIZE_ENABLED", True) and getattr(settings, "OPENAI_API_KEY", ""):
            candidates = list(
                Product.objects.filter(category=category)
                .select_related("product_subcategory")
                .order_by("id")
            )
            to_enrich = [p for p in candidates if needs_category(p) or needs_description(p)]
            if to_enrich:
                _progress(
                    f"Обогащение через OpenAI (описание + категория): товаров {len(to_enrich)}."
                )
            for idx, product in enumerate(to_enrich, start=1):
                need_cat = needs_category(product)
                need_desc = needs_description(product)
                _progress(
                    f"[{idx}/{len(to_enrich)}] Товар ID={product.id} '{product.name}': "
                    f"нужна_категория={need_cat}, нужно_описание={need_desc}."
                )
                ok, cat_updated, desc_updated = enrich_product(product)
                if ok:
                    _progress(
                        f"[{idx}/{len(to_enrich)}] Результат: "
                        f"категория_обновлена={cat_updated}, описание_обновлено={desc_updated}."
                    )
                    if cat_updated:
                        stats["categorized"] += 1
                    if desc_updated:
                        stats["descriptions_generated"] += 1
                else:
                    _progress(
                        f"[{idx}/{len(to_enrich)}] Результат: обогащение не удалось."
                    )
                    if need_cat:
                        stats["categorize_skipped"] += 1
                    if need_desc:
                        stats["descriptions_skipped"] += 1
            if to_enrich:
                _progress(
                    f"Категоризовано {stats['categorized']}, описаний сгенерировано {stats['descriptions_generated']}, не удалось {stats['categorize_skipped']}."
                )
        else:
            uncategorized_count = Product.objects.filter(
                category=category, product_subcategory__isnull=True
            ).count()
            if uncategorized_count:
                stats["categorize_skipped"] = uncategorized_count
                _progress(
                    "OpenAI отключен (OPENAI_CATEGORIZE_ENABLED или OPENAI_API_KEY). "
                    f"Товаров без подкатегории: {uncategorized_count}."
                )

        _last_sync_at = timezone.now()
        _last_sync_failed = False
        _progress(
            "Синк завершен: "
            f"страниц {stats['processed_pages']}, строк {stats['processed_rows']}, "
            f"подготовлено {stats['prepared_rows']}, отфильтровано {stats['filtered_out']}, "
            f"пропущено без id/названия {stats['skipped_no_id_or_name']}, с нулевой ценой {stats['skipped_zero_price']}, "
            f"создано {stats['created']}, обновлено {stats['updated']}, удалено {stats['deleted']}, "
            f"категоризовано {stats['categorized']}, описаний сгенерировано {stats['descriptions_generated']}."
        )
        if stats["prepared_rows"] == 0:
            _progress(
                f"Внимание: не найдено товаров по категории '{category_name}'. "
                "Проверьте sample_paths/sample_folder_names в итоге команды."
            )
        return stats
    except Exception:
        _last_sync_failed = True
        _progress("Синк завершился с ошибкой.")
        raise
