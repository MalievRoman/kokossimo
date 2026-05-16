import uuid
from dataclasses import dataclass
from datetime import timezone as dt_timezone
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from shop.models import Certificate, CertificateTransaction

from .certificate_issue import parse_amount
from .certificate_utils import get_certificate_by_id

_POS_CURRENCY = "RUB"


class CertificateRedeemError(Exception):
    pass


@dataclass(frozen=True)
class CertificateValidation:
    certificate: Certificate
    balance: Decimal
    currency: str


@dataclass(frozen=True)
class RedeemPreview:
    certificate: Certificate
    purchase_total: Decimal
    certificate_balance: Decimal
    redeemable_amount: Decimal
    amount_due_after: Decimal
    currency: str


@dataclass(frozen=True)
class RedeemResult:
    certificate: Certificate
    purchase_total: Decimal
    redeemed_amount: Decimal
    amount_due_after: Decimal
    currency: str


def _certificates_now():
    now = timezone.now()
    if timezone.is_aware(now):
        now = now.astimezone(dt_timezone.utc).replace(tzinfo=None)
    return now


def _certificate_balance(certificate: Certificate) -> Decimal:
    balance = certificate.current_balance
    if balance is None:
        return Decimal("0")
    return Decimal(balance).quantize(Decimal("0.01"))


def parse_purchase_total(raw: str) -> Decimal:
    try:
        return parse_amount(raw)
    except (ValueError, InvalidOperation) as exc:
        raise CertificateRedeemError(
            "Укажите корректную сумму покупки (положительное число)."
        ) from exc


def validate_purchase_total_within_balance(
    validation: CertificateValidation,
    purchase_total: Decimal,
) -> Decimal:
    total = Decimal(purchase_total).quantize(Decimal("0.01"))
    if total <= 0:
        raise CertificateRedeemError("Сумма списания должна быть больше нуля.")
    if total > validation.balance:
        raise CertificateRedeemError(
            f"Сумма списания не может быть больше остатка на сертификате "
            f"({validation.balance} {validation.currency})."
        )
    return total


def validate_certificate_for_apply(certificate: Certificate) -> CertificateValidation:
    if certificate.status == Certificate.Status.BLOCKED:
        raise CertificateRedeemError("Сертификат заблокирован.")
    if certificate.status in (Certificate.Status.REDEEMED, "used"):
        raise CertificateRedeemError("Сертификат полностью использован.")
    if certificate.is_expired:
        raise CertificateRedeemError("Срок действия сертификата истёк.")
    if not certificate.can_redeem_in_pos:
        raise CertificateRedeemError("Сертификат недоступен для списания.")

    balance = _certificate_balance(certificate)
    if balance <= 0:
        raise CertificateRedeemError("На сертификате нет доступного остатка.")

    currency = (certificate.currency or _POS_CURRENCY).strip().upper()
    if currency != _POS_CURRENCY:
        raise CertificateRedeemError(
            f"Валюта сертификата ({currency}) не поддерживается в точке продаж."
        )

    return CertificateValidation(
        certificate=certificate,
        balance=balance,
        currency=currency,
    )


def calculate_redeemable_amount(
    certificate: Certificate,
    purchase_total: Decimal,
) -> Decimal:
    validation = validate_certificate_for_apply(certificate)
    total = Decimal(purchase_total).quantize(Decimal("0.01"))
    if total <= 0:
        return Decimal("0")
    return min(validation.balance, total)


def build_redeem_preview(
    certificate: Certificate,
    purchase_total: Decimal,
) -> RedeemPreview:
    validation = validate_certificate_for_apply(certificate)
    total = validate_purchase_total_within_balance(validation, purchase_total)

    balance = validation.balance
    redeemable = calculate_redeemable_amount(certificate, total)
    if redeemable <= 0:
        raise CertificateRedeemError("Сертификат не покрывает покупку.")

    currency = (certificate.currency or _POS_CURRENCY).strip().upper()
    amount_due = (total - redeemable).quantize(Decimal("0.01"))
    if amount_due < 0:
        amount_due = Decimal("0")

    return RedeemPreview(
        certificate=certificate,
        purchase_total=total,
        certificate_balance=balance,
        redeemable_amount=redeemable,
        amount_due_after=amount_due,
        currency=currency,
    )


def redeem_certificate(
    *,
    certificate_id: str,
    purchase_total: Decimal,
    performed_by: int | None,
) -> RedeemResult:
    """Сразу списывает баланс в БД certificates (без черновика в магазинной БД)."""
    certificate = get_certificate_by_id(certificate_id)
    if certificate is None:
        raise CertificateRedeemError("Сертификат не найден.")

    preview = build_redeem_preview(certificate, purchase_total)
    amount = preview.redeemable_amount
    balance_before = preview.certificate_balance
    balance_after = (balance_before - amount).quantize(Decimal("0.01"))
    new_status = (
        Certificate.Status.REDEEMED
        if balance_after <= 0
        else Certificate.Status.PARTIALLY_REDEEMED
    )
    now = _certificates_now()

    with transaction.atomic(using="certificates"):
        updated = Certificate.objects.using("certificates").filter(
            pk=certificate.pk,
            status__in=(
                Certificate.Status.CREATED,
                Certificate.Status.PARTIALLY_REDEEMED,
            ),
        ).update(
            current_balance=balance_after,
            status=new_status,
            updated_at=now,
        )
        if not updated:
            raise CertificateRedeemError(
                "Не удалось списать баланс. Сертификат мог быть изменён."
            )

        CertificateTransaction.objects.using("certificates").create(
            certificate_id=certificate.pk,
            type=CertificateTransaction.TransactionType.REDEEM,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            currency=preview.currency,
            order_id=None,
            performed_by=performed_by,
            reason="Списание в точке продаж",
            idempotency_key=f"staff-redeem-{uuid.uuid4().hex}",
            created_at=now,
            metadata={
                "source": "staff_portal",
                "purchase_total": str(preview.purchase_total),
            },
        )

    refreshed = get_certificate_by_id(certificate.pk)
    if refreshed is None:
        raise CertificateRedeemError("Сертификат не найден после списания.")

    return RedeemResult(
        certificate=refreshed,
        purchase_total=preview.purchase_total,
        redeemed_amount=amount,
        amount_due_after=preview.amount_due_after,
        currency=preview.currency,
    )
