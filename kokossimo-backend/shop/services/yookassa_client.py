from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.conf import settings
from yookassa import Configuration, Payment


class YooKassaConfigError(Exception):
    pass


class YooKassaServiceError(Exception):
    pass


@dataclass
class YooKassaPaymentData:
    payment_id: str
    status: str
    amount_value: str
    confirmation_url: str
    raw: dict


def _as_dict(obj):
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "json"):
        try:
            value = obj.json()
            if isinstance(value, dict):
                return value
        except Exception:
            pass
    if hasattr(obj, "__dict__"):
        return dict(obj.__dict__)
    return {}


def _append_order_to_return_url(base_url, order_id):
    if not base_url:
        return ""
    parsed = urlparse(base_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["order"] = str(order_id)
    return urlunparse(parsed._replace(query=urlencode(query)))


class YooKassaClient:
    def __init__(self):
        self.shop_id = (getattr(settings, "YOOKASSA_SHOP_ID", "") or "").strip()
        self.secret_key = (getattr(settings, "YOOKASSA_SECRET_KEY", "") or "").strip()
        self.return_url = (getattr(settings, "YOOKASSA_RETURN_URL", "") or "").strip()
        self.capture = bool(getattr(settings, "YOOKASSA_CAPTURE_PAYMENT", True))

        if not self.shop_id or not self.secret_key:
            raise YooKassaConfigError("YooKassa не настроена: задайте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY.")
        if not self.return_url:
            raise YooKassaConfigError("YooKassa не настроена: задайте YOOKASSA_RETURN_URL.")

        Configuration.account_id = self.shop_id
        Configuration.secret_key = self.secret_key

    def create_payment(self, *, order_id, amount: Decimal, description: str = "") -> YooKassaPaymentData:
        normalized_amount = f"{Decimal(amount):.2f}"
        idempotence_key = f"order-{order_id}-amount-{normalized_amount}"
        return_url = _append_order_to_return_url(self.return_url, order_id)

        payload = {
            "amount": {
                "value": normalized_amount,
                "currency": "RUB",
            },
            "capture": self.capture,
            "confirmation": {
                "type": "redirect",
                "return_url": return_url,
            },
            "description": description or f"Оплата заказа #{order_id}",
            "metadata": {
                "order_id": str(order_id),
            },
        }

        try:
            payment = Payment.create(payload, idempotence_key=idempotence_key)
        except Exception as exc:
            raise YooKassaServiceError("Не удалось создать платеж в YooKassa.") from exc

        data = _as_dict(payment)
        payment_id = str(data.get("id") or "")
        status = str(data.get("status") or "")
        amount_value = str((_as_dict(data.get("amount"))).get("value") or "")
        confirmation_url = str((_as_dict(data.get("confirmation"))).get("confirmation_url") or "")

        if not payment_id:
            raise YooKassaServiceError("YooKassa вернула ответ без payment_id.")
        if not confirmation_url:
            raise YooKassaServiceError("YooKassa вернула ответ без ссылки подтверждения.")

        return YooKassaPaymentData(
            payment_id=payment_id,
            status=status,
            amount_value=amount_value,
            confirmation_url=confirmation_url,
            raw=data,
        )

    def get_payment(self, payment_id: str) -> dict:
        try:
            payment = Payment.find_one(payment_id)
        except Exception as exc:
            raise YooKassaServiceError("Не удалось получить статус платежа в YooKassa.") from exc
        return _as_dict(payment)
