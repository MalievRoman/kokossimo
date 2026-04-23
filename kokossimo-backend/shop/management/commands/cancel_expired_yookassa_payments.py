import uuid
from datetime import datetime, timedelta, timezone as datetime_timezone

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from yookassa import Configuration, Payment

from shop.models import Order


def _parse_yookassa_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, datetime_timezone.utc)
    return dt


def _payment_ttl_minutes():
    try:
        ttl = int(getattr(settings, "YOOKASSA_PAYMENT_TTL_MINUTES", 15))
    except (TypeError, ValueError):
        ttl = 15
    return max(1, ttl)


def _payment_is_expired(payment):
    created_at = _parse_yookassa_datetime(getattr(payment, "created_at", None))
    if not created_at:
        return False
    return timezone.now() >= (created_at + timedelta(minutes=_payment_ttl_minutes()))


def _sync_order_from_payment(order, payment):
    payment_status = str(getattr(payment, "status", "") or "")
    if not payment_status:
        return

    updates = {
        "payment_provider": "yookassa",
        "payment_id": str(getattr(payment, "id", "") or order.payment_id or ""),
        "payment_status": payment_status,
    }

    if payment_status == "succeeded":
        updates["status"] = "paid"
        updates["yookassa_payment_id"] = updates["payment_id"]
        if not order.paid_at:
            updates["paid_at"] = timezone.now()
    elif payment_status == "canceled":
        updates["status"] = "cancelled"

    changed_fields = []
    for field, value in updates.items():
        if getattr(order, field) != value:
            setattr(order, field, value)
            changed_fields.append(field)
    if changed_fields:
        order.save(update_fields=changed_fields)


class Command(BaseCommand):
    help = (
        "Отменяет просроченные pending/waiting_for_capture платежи YooKassa "
        "по локальному TTL (YOOKASSA_PAYMENT_TTL_MINUTES)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать, какие платежи были бы отменены, без отмены.",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "YOOKASSA_SHOP_ID", "") or not getattr(settings, "YOOKASSA_SECRET_KEY", ""):
            self.stdout.write(self.style.WARNING("YooKassa не настроена, пропуск."))
            return

        dry_run = bool(options.get("dry_run"))
        Configuration.account_id = settings.YOOKASSA_SHOP_ID
        Configuration.secret_key = settings.YOOKASSA_SECRET_KEY

        queryset = Order.objects.filter(
            payment_provider="yookassa",
            payment_id__isnull=False,
        ).exclude(payment_id="").filter(
            payment_status__in=("pending", "waiting_for_capture"),
        )

        checked = 0
        canceled = 0
        errors = 0

        for order in queryset.iterator():
            checked += 1
            payment_id = str(order.payment_id or "").strip()
            if not payment_id:
                continue

            try:
                payment = Payment.find_one(payment_id)
            except Exception as exc:
                errors += 1
                self.stdout.write(f"[error] order={order.id} payment={payment_id} find_one failed: {exc}")
                continue

            _sync_order_from_payment(order, payment)
            current_status = str(getattr(payment, "status", "") or "")
            if current_status not in ("pending", "waiting_for_capture"):
                continue
            if not _payment_is_expired(payment):
                continue

            if dry_run:
                self.stdout.write(f"[dry-run] order={order.id} payment={payment_id} would be canceled")
                canceled += 1
                continue

            try:
                try:
                    canceled_payment = Payment.cancel(payment_id, str(uuid.uuid4()))
                except TypeError:
                    canceled_payment = Payment.cancel(payment_id)
                _sync_order_from_payment(order, canceled_payment)
                canceled += 1
                self.stdout.write(f"[ok] order={order.id} payment={payment_id} canceled")
            except Exception as exc:
                errors += 1
                self.stdout.write(f"[error] order={order.id} payment={payment_id} cancel failed: {exc}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: checked={checked}, canceled={canceled}, errors={errors}, dry_run={dry_run}"
            )
        )
