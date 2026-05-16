from django.urls import reverse

STAFF_HUB_ITEMS = (
    {
        "title": "Проверка сертификатов",
        "description": "Поиск по номеру, данные и списание в точке продаж",
        "url_name": "certificate_lookup",
    },
    {
        "title": "Создание сертификата",
        "description": "Выпуск нового подарочного сертификата для клиента",
        "url_name": "certificate_create",
    },
    {
        "title": "Применение сертификата",
        "description": "Офлайн: сумма покупки, расчёт списания и финализация",
        "url_name": "certificate_apply",
    },
)


def staff_hub_links() -> list[dict[str, str]]:
    return [
        {
            "title": item["title"],
            "description": item.get("description", ""),
            "href": reverse(f"staff_portal:{item['url_name']}"),
        }
        for item in STAFF_HUB_ITEMS
    ]
