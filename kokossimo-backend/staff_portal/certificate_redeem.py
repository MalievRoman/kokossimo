import uuid
from dataclasses import dataclass
from datetime import timezone as dt_timezone
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from shop.models import (
    Certificate,
    CertificateTransaction,
    OrderCertificateApplication,
)

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
    validate_certificate_for_apply(certificate)

    total = Decimal(purchase_total).quantize(Decimal("0.01"))
    if total <= 0:
        raise CertificateRedeemError("Сумма покупки должна быть больше нуля.")

    balance = _certificate_balance(certificate)
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


@transaction.atomic
def apply_certificate(
    *,
    certificate_id: str,
    purchase_total: Decimal,
    performed_by: int | None,
) -> OrderCertificateApplication:
    certificate = get_certificate_by_id(certificate_id)
    if certificate is None:
        raise CertificateRedeemError("Сертификат не найден.")

    preview = build_redeem_preview(certificate, purchase_total)

    if OrderCertificateApplication.objects.filter(
        certificate_id=certificate.pk,
        status=OrderCertificateApplication.Status.PENDING,
    ).exists():
        raise CertificateRedeemError(
            "Этот сертификат уже применён (ожидает списания). Завершите или отмените предыдущее применение."
        )

    return OrderCertificateApplication.objects.create(
        certificate_id=certificate.pk,
        purchase_total=preview.purchase_total,
        amount=preview.redeemable_amount,
        currency=preview.currency,
        status=OrderCertificateApplication.Status.PENDING,
        performed_by=performed_by,
    )


def finalize_certificate_application(
    application: OrderCertificateApplication,
    *,
    performed_by: int | None,
) -> Certificate:
    if application.status != OrderCertificateApplication.Status.PENDING:
        raise CertificateRedeemError("Применение уже обработано или отменено.")

    certificate = get_certificate_by_id(application.certificate_id)
    if certificate is None:
        raise CertificateRedeemError("Сертификат не найден.")

    validate_certificate_for_apply(certificate)

    amount = Decimal(application.amount).quantize(Decimal("0.01"))
    balance_before = _certificate_balance(certificate)
    if amount > balance_before:
        raise CertificateRedeemError(
            "Недостаточно средств на сертификате. Обновите страницу и проверьте остаток."
        )

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
            currency=application.currency,
            order_id=None,
            performed_by=performed_by,
            reason="Списание в точке продаж",
            idempotency_key=f"staff-redeem-{application.pk}-{uuid.uuid4().hex}",
            created_at=now,
            metadata={
                "source": "staff_portal",
                "application_id": application.pk,
                "purchase_total": str(application.purchase_total),
            },
        )

    application.status = OrderCertificateApplication.Status.FINALIZED
    application.finalized_at = timezone.now()
    application.save(update_fields=["status", "finalized_at"])

    refreshed = get_certificate_by_id(certificate.pk)
    if refreshed is None:
        raise CertificateRedeemError("Сертификат не найден после списания.")
    return refreshed


@transaction.atomic
def cancel_certificate_application(application: OrderCertificateApplication) -> None:
    if application.status != OrderCertificateApplication.Status.PENDING:
        raise CertificateRedeemError("Можно отменить только ожидающее применение.")
    application.status = OrderCertificateApplication.Status.CANCELLED
    application.save(update_fields=["status"])
