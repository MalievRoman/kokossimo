"""
Единый конфиг городов доставки (тарифы, пункты выдачи).
Отдаётся в API и используется при расчёте total_price заказа.
"""

from decimal import Decimal

DELIVERY_CITIES = {
    "moscow": {
        "label": "Москва",
        "courierAvailable": False,
        "pickupFee": 0,
        "courierFee": 0,
        "pickupProvider": "СДЭК",
        "pickupPoints": [
            {
                "id": "msk-537",
                "name": "Пункт СДЭК MSK537",
                "address": "Москва, 2-й Хвостов переулок, 12",
                "type": "Пункт выдачи",
                "weight": "до 35 кг",
                "hours": "с 9:00 до 21:00",
            },
            {
                "id": "msk-589",
                "name": "Пункт СДЭК MSK589",
                "address": "Москва, Волгоградский проспект, 32, корпус 2",
                "type": "Пункт выдачи",
                "weight": "до 25 кг",
                "hours": "с 10:00 до 21:00",
            },
            {
                "id": "msk-2360",
                "name": "Пункт СДЭК MSK2360",
                "address": "Москва, ул. Таганская, 25-27",
                "type": "Постомат",
                "weight": "до 15 кг",
                "hours": "круглосуточно",
            },
        ],
    },
    "saint_petersburg": {
        "label": "Санкт-Петербург",
        "courierAvailable": False,
        "pickupFee": 0,
        "courierFee": 0,
        "pickupProvider": "СДЭК",
        "pickupPoints": [
            {
                "id": "spb-102",
                "name": "Пункт СДЭК SPB102",
                "address": "Санкт-Петербург, Лиговский проспект, 50",
                "type": "Пункт выдачи",
                "weight": "до 25 кг",
                "hours": "с 10:00 до 21:00",
            },
            {
                "id": "spb-103",
                "name": "Пункт СДЭК SPB103",
                "address": "Санкт-Петербург, Невский проспект, 98",
                "type": "Постомат",
                "weight": "до 15 кг",
                "hours": "круглосуточно",
            },
        ],
    },
    "elista": {
        "label": "Элиста",
        "courierAvailable": True,
        "pickupFee": 0,
        "courierFee": 600,
        "pickupProvider": "KOKOSSIMO",
        "pickupPoints": [
            {
                "id": "elista-store",
                "name": "Магазин KOKOSSIMO",
                "address": "Элиста, улица А. Сусеева, 13",
                "type": "Самовывоз из магазина",
                "weight": "без ограничений",
                "hours": "с 9:00 до 20:00",
            },
        ],
    },
}


def delivery_fee_rub(city: str, delivery_method: str) -> Decimal:
    if delivery_method not in ("pickup", "courier"):
        return Decimal("0")
    normalized = (city or "").strip().casefold()
    for cfg in DELIVERY_CITIES.values():
        if cfg["label"].strip().casefold() == normalized:
            amount = cfg["pickupFee"] if delivery_method == "pickup" else cfg["courierFee"]
            return Decimal(str(amount))
    return Decimal("0")
