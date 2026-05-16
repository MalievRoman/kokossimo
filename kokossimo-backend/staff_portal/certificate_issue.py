import secrets
import string
import uuid
from datetime import datetime, time
from datetime import timezone as dt_timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone

from shop.models import Certificate, CertificateTransaction

_CERT_ID_ALPHABET = string.ascii_lowercase + string.digits
_CERT_ID_LENGTH = 16
_ALLOWED_CURRENCIES = frozenset({"RUB", "USD", "EUR"})


def generate_certificate_id() -> str:
    return "".join(secrets.choice(_CERT_ID_ALPHABET) for _ in range(_CERT_ID_LENGTH))


def allocate_certificate_id(max_attempts: int = 25) -> str:
    for _ in range(max_attempts):
        cert_id = generate_certificate_id()
        if not Certificate.objects.filter(pk=cert_id).exists():
            return cert_id
    raise RuntimeError("Не удалось сгенерировать уникальный номер сертификата")


def parse_amount(raw: str) -> Decimal:
    normalized = (raw or "").strip().replace(",", ".")
    if not normalized:
        raise ValueError("empty")
    amount = Decimal(normalized)
    if amount <= 0:
        raise ValueError("non_positive")
    return amount.quantize(Decimal("0.01"))


def parse_expires_at(raw: str) -> datetime:
    """Дата окончания действия (конец выбранного дня, naive UTC для БД certificates)."""
    try:
        day = datetime.strptime(raw.strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("invalid_date") from exc
    expires = datetime.combine(day, time(23, 59, 59), tzinfo=dt_timezone.utc)
    if expires <= timezone.now():
        raise ValueError("past_date")
    return expires.replace(tzinfo=None)


def validate_create_form(data: dict[str, str]) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    cleaned: dict[str, Any] = {
        "initial_amount": (data.get("initial_amount") or "").strip(),
        "expires_at": (data.get("expires_at") or "").strip(),
        "currency": ((data.get("currency") or "RUB").strip().upper()),
        "owner_customer_id": (data.get("owner_customer_id") or "").strip(),
        "comment": (data.get("comment") or "").strip(),
        "customer_query": (data.get("customer_query") or "").strip(),
        "selected_customer_label": (data.get("selected_customer_label") or "").strip(),
    }

    amount: Decimal | None = None
    try:
        amount = parse_amount(cleaned["initial_amount"])
    except (ValueError, InvalidOperation):
        errors.append("Укажите корректный номинал (положительное число).")

    expires_at: datetime | None = None
    try:
        expires_at = parse_expires_at(cleaned["expires_at"])
    except ValueError as err:
        if str(err) == "past_date":
            errors.append("Срок действия должен быть в будущем.")
        else:
            errors.append("Укажите корректную дату окончания действия.")

    currency = cleaned["currency"]
    if currency not in _ALLOWED_CURRENCIES:
        errors.append("Выберите поддерживаемую валюту.")

    owner_id: int | None = None
    owner_raw = cleaned["owner_customer_id"]
    if owner_raw:
        try:
            owner_id = int(owner_raw)
            if owner_id <= 0:
                raise ValueError
        except ValueError:
            errors.append("Некорректный получатель. Выберите клиента из результатов поиска.")

    cleaned["parsed_amount"] = amount
    cleaned["parsed_expires_at"] = expires_at
    cleaned["parsed_owner_id"] = owner_id
    cleaned["parsed_currency"] = currency
    return cleaned, errors


@transaction.atomic(using="certificates")
def issue_certificate(
    *,
    amount: Decimal,
    currency: str,
    expires_at: datetime,
    owner_customer_id: int | None,
    comment: str,
    created_by: int | None,
) -> Certificate:
    cert_id = allocate_certificate_id()
    now = timezone.now()
    if timezone.is_aware(now):
        now = now.astimezone(dt_timezone.utc).replace(tzinfo=None)

    metadata: dict[str, Any] = {}
    if comment:
        metadata["comment"] = comment

    certificate = Certificate.objects.using("certificates").create(
        id=cert_id,
        status=Certificate.Status.CREATED,
        currency=currency,
        initial_amount=amount,
        current_balance=amount,
        expires_at=expires_at,
        created_at=now,
        updated_at=now,
        created_by=created_by,
        owner_customer_id=owner_customer_id,
        metadata=metadata,
    )

    CertificateTransaction.objects.using("certificates").create(
        certificate_id=cert_id,
        type=CertificateTransaction.TransactionType.ISSUE,
        amount=amount,
        balance_before=Decimal("0"),
        balance_after=amount,
        currency=currency,
        performed_by=created_by,
        idempotency_key=f"staff-issue-{cert_id}-{uuid.uuid4().hex}",
        created_at=now,
        metadata={"source": "staff_portal"},
    )

    return certificate
