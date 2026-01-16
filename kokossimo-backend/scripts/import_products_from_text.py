import os
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.utils.text import slugify  # noqa: E402
from shop.models import Category, Product  # noqa: E402


CATEGORY_LINE = re.compile(r"^\s*\d+\.\s*(.+)$")
PRODUCT_LINE = re.compile(r"^\s*\d+\)\s*(.+)$")
ALT_PRODUCT_LINE = re.compile(r"^\s*•\s*(.+)$")
PRICE_LINE = re.compile(r"^\s*•\s*Цена:\s*(.+)$", re.IGNORECASE)
DESC_LINE = re.compile(r"^\s*•\s*Описание:\s*(.*)$", re.IGNORECASE)
PHOTO_LINE = re.compile(r"^\s*•\s*Фото:\s*(.+)$", re.IGNORECASE)


def parse_price(raw):
    match = re.search(r"([0-9]+(?:[.,][0-9]+)?)", raw)
    if not match:
        return None
    value = match.group(1).replace(",", ".")
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def find_photo_file(photo_label, media_dir):
    photo_label = photo_label.strip()
    if not photo_label:
        return None

    # If user provided extension, check directly
    direct_path = media_dir / photo_label
    if direct_path.exists():
        return direct_path.name

    # Try to find by stem (case-insensitive)
    for file_path in media_dir.iterdir():
        if file_path.is_file():
            if file_path.stem.lower() == photo_label.lower():
                return file_path.name

    return None


def parse_text(text):
    categories = []
    current_category = None
    current_product = None
    in_description = False

    def flush_product():
        nonlocal current_product, in_description
        if current_product:
            current_product["description"] = "\n".join(
                line.strip() for line in current_product["description"] if line.strip()
            ).strip()
            categories[-1]["products"].append(current_product)
        current_product = None
        in_description = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        category_match = CATEGORY_LINE.match(line)
        if category_match and not line.startswith("1)"):
            flush_product()
            current_category = category_match.group(1).strip()
            categories.append({"name": current_category, "products": []})
            continue

        product_match = PRODUCT_LINE.match(line)
        alt_product_match = ALT_PRODUCT_LINE.match(line)
        if product_match:
            flush_product()
            current_product = {
                "name": product_match.group(1).strip(),
                "price": None,
                "description": [],
                "photo": "",
            }
            continue

        if alt_product_match and not PRICE_LINE.match(line) and not DESC_LINE.match(line) and not PHOTO_LINE.match(line):
            flush_product()
            current_product = {
                "name": alt_product_match.group(1).strip(),
                "price": None,
                "description": [],
                "photo": "",
            }
            continue

        if not current_product:
            continue

        price_match = PRICE_LINE.match(line)
        if price_match:
            current_product["price"] = parse_price(price_match.group(1))
            continue

        desc_match = DESC_LINE.match(line)
        if desc_match:
            in_description = True
            current_product["description"].append(desc_match.group(1))
            continue

        photo_match = PHOTO_LINE.match(line)
        if photo_match:
            current_product["photo"] = photo_match.group(1).strip()
            in_description = False
            continue

        if in_description:
            current_product["description"].append(line)

    flush_product()
    return categories


def import_products(text_path):
    media_dir = BASE_DIR / "media" / "products"
    if not media_dir.exists():
        print(f"[WARN] Фото не найдены: {media_dir}")

    text = Path(text_path).read_text(encoding="utf-8")
    categories = parse_text(text)

    Product.objects.all().delete()
    Category.objects.all().delete()

    created_products = 0
    for category_data in categories:
        slug = slugify(category_data["name"], allow_unicode=True)
        category, _ = Category.objects.get_or_create(
            slug=slug,
            defaults={"name": category_data["name"]},
        )

        for product_data in category_data["products"]:
            if not product_data["name"] or product_data["price"] is None:
                print(f"[SKIP] Некорректные данные: {product_data.get('name')}")
                continue

            photo_file = find_photo_file(product_data["photo"], media_dir)
            if not photo_file:
                print(f"[WARN] Фото не найдено для '{product_data['name']}': {product_data['photo']}")

            product = Product(
                category=category,
                name=product_data["name"],
                description=product_data["description"] or "",
                price=product_data["price"],
            )
            if photo_file:
                product.image.name = f"products/{photo_file}"
            product.save()
            created_products += 1

    print(f"Импортировано товаров: {created_products}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_products_from_text.py <path_to_text_file>")
        sys.exit(1)

    import_products(sys.argv[1])
