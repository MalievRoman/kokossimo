"""
Категоризация и генерация описаний товаров через OpenAI API.
Один объединённый промпт: сначала генерируется описание, затем выдаётся код подкатегории.
"""
import logging
import re

from django.conf import settings

logger = logging.getLogger(__name__)

# Минимальная длина описания, чтобы не перезаписывать (если короче — генерируем)
MIN_DESCRIPTION_LENGTH = 50

# Коды только «листовых» подкатегорий (без родительских 1–6)
VALID_SUBCATEGORY_CODES = [
    "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8",
    "2.1", "2.2", "2.3", "2.4",
    "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7",
    "4.1", "4.2", "4.3", "4.4", "4.5", "4.6",
    "5.1", "5.2", "5.3", "5.4", "5.5", "5.6",
    "6.1", "6.2", "6.3", "6.4", "6.5",
]

CATEGORY_LIST_FOR_PROMPT = """
1) Косметика для лица: 1.1 очищение, 1.2 тонизирование, 1.3 для кожи вокруг глаз, 1.4 защита от солнца, 1.5 пилинги, 1.6 увлажнение, 1.7 направленный уход, 1.8 маски
2) Макияж: 2.1 для лица, 2.2 для глаз и бровей, 2.3 для губ, 2.4 аксессуары для макияжа
3) Средства для тела: 3.1 для душа, 3.2 для ванны, 3.3 уход, 3.4 гигиена, 3.5 для рук, 3.6 уход за полостью рта, 3.7 для ног
4) Средства для волос: 4.1 шампуни, 4.2 кондиционеры, 4.3 уход за кожей головы, 4.4 уход для волос, 4.5 аксессуары для волос, 4.6 стайлинг
5) БАДы: 5.1 витамины, 5.2 минералы, 5.3 для красоты, 5.4 для иммунитета, 5.5 для пищеварения, 5.6 прочее
6) Парфюмерия (духи, туалетная вода, парфюм, ароматы, EDP, EDT, parfum, fragrance): 6.1 женская, 6.2 мужская, 6.3 унисекс, 6.4 миниатюры, 6.5 аксессуары
Важно: если в названии или описании есть парфюм/духи/аромат/EDP/EDT/туалетная вода — выбирай подкатегорию из пункта 6 (6.1, 6.2 или 6.3 по полу/унисекс).
"""

# В ответе модели в конце должна быть строка "КАТЕГОРИЯ: X.Y"
CATEGORY_LINE_PATTERN = re.compile(r"\n\s*КАТЕГОРИЯ:\s*(\d+\.\d+)\s*$", re.IGNORECASE)


def _get_openai_client():
    """Общий клиент OpenAI при наличии ключа."""
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return None
    if not getattr(settings, "OPENAI_CATEGORIZE_ENABLED", True):
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)


def _call_openai_description_and_category(name: str, current_description: str) -> tuple[str | None, str | None]:
    """
    Один вызов OpenAI: сначала описание товара, затем код подкатегории.
    Возвращает (описание, код_категории). Если что-то не распознано — None.
    """
    client = _get_openai_client()
    if not client:
        return None, None

    try:
        model = getattr(settings, "OPENAI_CATEGORIZE_MODEL", "gpt-4o-mini")
        desc_hint = f" Текущее описание (можно использовать как основу): {current_description[:500]}." if current_description.strip() else ""

        prompt = f"""Сделай два шага по названию товара.

Шаг 1 — Описание. Напиши короткое продающее описание косметического/бытового товара для карточки в интернет-магазине.
- Язык: русский.
- Текст должен быть связным: один или два плавных абзаца, цельные предложения. Без списков, без перечислений через точку с запятой, без буллетов и заголовков типа «Верхние ноты:», «Состав:». Не разбивай на отдельные короткие фразы — пиши связно.
- 2–4 предложения (примерно 200–500 символов).
- Не указывай цену и точный состав, не давай медицинских обещаний.
- Опиши: для чего продукт, для кого подходит, ключевой эффект или характер аромата/средства.{desc_hint}

Шаг 2 — Категория. Выбери ОДНУ подкатегорию из списка и в конце ответа напиши строго с новой строки: КАТЕГОРИЯ: X.Y (например КАТЕГОРИЯ: 1.1 или КАТЕГОРИЯ: 6.2).

Список подкатегорий:
{CATEGORY_LIST_FOR_PROMPT}

Допустимые коды: {", ".join(VALID_SUBCATEGORY_CODES)}

Название товара: {name}

Сначала текст описания (связным абзацем), затем с новой строки строка КАТЕГОРИЯ: X.Y"""

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=700,
            temperature=0.4,
        )
        raw = (response.choices[0].message.content or "").strip()

        # Парсим код категории в конце
        cat_match = CATEGORY_LINE_PATTERN.search(raw)
        code = None
        if cat_match:
            code = cat_match.group(1).strip()
            if code not in VALID_SUBCATEGORY_CODES:
                code = None
        if not code and raw:
            # Fallback: последнее вхождение X.Y в ответе
            for m in re.finditer(r"(\d+\.\d+)", raw):
                if m.group(1) in VALID_SUBCATEGORY_CODES:
                    code = m.group(1)

        # Описание — всё до строки КАТЕГОРИЯ
        if cat_match:
            description = raw[: cat_match.start()].strip()
        else:
            description = raw.strip()
        # Убираем возможный префикс "Описание:" и лишние переносы
        if description.lower().startswith("описание:"):
            description = description[9:].strip()
        if len(description) < 30:
            description = None
        elif len(description) > 5000:
            description = description[:5000]

        return description, code
    except Exception as e:
        logger.exception("Ошибка при вызове OpenAI (описание + категория): %s", e)
        return None, None


def needs_category(product) -> bool:
    """True, если у товара не задана подкатегория."""
    return not product.product_subcategory_id


def needs_description(product) -> bool:
    """True, если у товара нет осмысленного описания и его нужно сгенерировать."""
    desc = (product.description or "").strip()
    return len(desc) < MIN_DESCRIPTION_LENGTH


def enrich_product(product) -> tuple[bool, bool, bool]:
    """
    Один вызов OpenAI: генерирует описание и определяет подкатегорию по названию.
    Обновляет product.description и product.product_subcategory только если они пустые/короткие.
    Возвращает (успех, категория_обновлена, описание_обновлено).
    """
    needs_cat = needs_category(product)
    needs_desc = needs_description(product)
    if not needs_cat and not needs_desc:
        return True, False, False

    description_text, category_code = _call_openai_description_and_category(
        product.name, product.description or ""
    )
    if not description_text and not category_code:
        return False, False, False

    from .models import ProductSubcategory

    update_fields = []
    cat_updated = False
    desc_updated = False
    if needs_desc and description_text:
        product.description = description_text
        update_fields.append("description")
        desc_updated = True
    if needs_cat and category_code:
        try:
            sub = ProductSubcategory.objects.get(code=category_code)
            product.product_subcategory = sub
            update_fields.append("product_subcategory")
            cat_updated = True
        except ProductSubcategory.DoesNotExist:
            logger.warning("Подкатегория с кодом %s не найдена в БД.", category_code)

    if update_fields:
        product.save(update_fields=update_fields)
    return True, cat_updated, desc_updated
