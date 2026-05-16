import uuid
from dataclasses import dataclass
from datetime import timezone as dt_timezone
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from shop.models import (
    Certificate,
    CertificateTransaction,
    Order,
    OrderCertificateApplication,
)

from .certificate_utils import get_certificate_by_id

_APPLICABLE_ORDER_STATUSES = frozenset({"new", "awaiting_payment", "processing"})
_ORDER_CURRENCY = "RUB"


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
    order: Order
    order_total: Decimal
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

    currency = (certificate.currency or _ORDER_CURRENCY).strip().upper()
    if currency != _ORDER_CURRENCY:
        raise CertificateRedeemError(
            f"Валюта сертификата ({currency}) не совпадает с валютой заказа ({_ORDER_CURRENCY})."
        )

    return CertificateValidation(
        certificate=certificate,
        balance=balance,
        currency=currency,
    )


def _validate_order_for_apply(order: Order) -> None:
    if order.status == "cancelled":
        raise CertificateRedeemError("Заказ отменён.")
    if order.status not in _APPLICABLE_ORDER_STATUSES:
        raise CertificateRedeemError(
            f"К заказу в статусе «{order.get_status_display()}» нельзя применить сертификат."
        )
    if OrderCertificateApplication.objects.filter(
        order=order,
        status=OrderCertificateApplication.Status.PENDING,
    ).exists():
        raise CertificateRedeemError("К этому заказу уже применён сертификат (ожидает списания).")
    if (order.certificate_discount or 0) > 0:
        raise CertificateRedeemError("По этому заказу сертификат уже был списан.")


def calculate_redeemable_amount(
    certificate: Certificate,
    order_total: Decimal,
) -> Decimal:
    validation = validate_certificate_for_apply(certificate)
    total = Decimal(order_total).quantize(Decimal("0.01"))
    if total <= 0:
        return Decimal("0")
    return min(validation.balance, total)


def build_redeem_preview(certificate: Certificate, order: Order) -> RedeemPreview:
    validate_certificate_for_apply(certificate)
    _validate_order_for_apply(order)

    order_total = Decimal(order.total_price or 0).quantize(Decimal("0.01"))
    balance = _certificate_balance(certificate)
    redeemable = calculate_redeemable_amount(certificate, order_total)
    if redeemable <= 0:
        raise CertificateRedeemError("Сумма заказа равна нулю или сертификат не покрывает заказ.")

    currency = (certificate.currency or _ORDER_CURRENCY).strip().upper()
    amount_due = (order_total - redeemable).quantize(Decimal("0.01"))
    if amount_due < 0:
        amount_due = Decimal("0")

    return RedeemPreview(
        certificate=certificate,
        order=order,
        order_total=order_total,
        certificate_balance=balance,
        redeemable_amount=redeemable,
        amount_due_after=amount_due,
        currency=currency,
    )


@transaction.atomic
def apply_certificate_to_order(
    *,
    certificate_id: str,
    order_id: int,
    performed_by: int | None,
) -> OrderCertificateApplication:
    certificate = get_certificate_by_id(certificate_id)
    if certificate is None:
        raise CertificateRedeemError("Сертификат не найден.")

    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist as exc:
        raise CertificateRedeemError("Заказ не найден.") from exc

    preview = build_redeem_preview(certificate, order)

    if OrderCertificateApplication.objects.filter(
        certificate_id=certificate.pk,
        status=OrderCertificateApplication.Status.PENDING,
    ).exists():
        raise CertificateRedeemError(
            "Этот сертификат уже применён к другому заказу (ожидает списания)."
        )

    return OrderCertificateApplication.objects.create(
        order=order,
        certificate_id=certificate.pk,
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
        updated = Certificate.objects.filter(
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
            order_id=application.order_id,
            performed_by=performed_by,
            reason=f"Списание по заказу #{application.order_id}",
            idempotency_key=f"staff-redeem-{application.pk}-{uuid.uuid4().hex}",
            created_at=now,
            metadata={"source": "staff_portal", "application_id": application.pk},
        )

    with transaction.atomic():
        application.status = OrderCertificateApplication.Status.FINALIZED
        application.finalized_at = timezone.now()
        application.save(update_fields=["status", "finalized_at"])

        order = application.order
        order.certificate_discount = amount
        order.save(update_fields=["certificate_discount", "updated_at"])

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
