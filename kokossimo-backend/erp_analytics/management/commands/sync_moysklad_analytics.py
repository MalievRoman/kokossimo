import hashlib
import json
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from erp_analytics.models import (
    MoyskladCustomerOrder,
    RawMoyskladRecord,
    SyncCheckpoint,
)
from shop.moysklad import MoySkladClient, MoySkladConfigError, MoySkladError


def _safe_text(value):
    if value is None:
        return ""
    return str(value).replace("\x00", "").strip()


def _safe_datetime(value):
    text = _safe_text(value)
    if not text:
        return None
    dt = parse_datetime(text)
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _to_money(raw_value):
    if raw_value is None:
        return Decimal("0.00")
    try:
        return (Decimal(str(raw_value)) / Decimal("100")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def _payload_hash(payload):
    normalized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class Command(BaseCommand):
    help = (
        "Изолированная синхронизация МойСклад в отдельную analytics-БД "
        "(raw + очищенные заказы)."
    )

    analytics_alias = "analytics"
    entity = "customerorder"

    def add_arguments(self, parser):
        parser.add_argument(
            "--page-size",
            type=int,
            default=100,
            help="Размер страницы API (1..1000). По умолчанию 100.",
        )
        parser.add_argument(
            "--max-pages",
            type=int,
            default=0,
            help="Лимит страниц для одного запуска (0 = без лимита).",
        )
        parser.add_argument(
            "--full-refresh",
            action="store_true",
            help="Игнорировать checkpoint и перезагрузить все доступные данные.",
        )

    def _build_filter_expr(self, checkpoint_dt):
        if not checkpoint_dt:
            return ""
        # Формат фильтра подходит для большинства сущностей remap API.
        stamp = checkpoint_dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        return f"updated>{stamp}"

    def _extract_clean_order(self, row):
        state = row.get("state") or {}
        organization = row.get("organization") or {}
        agent = row.get("agent") or {}
        return {
            "order_number": _safe_text(row.get("name")),
            "moment": _safe_datetime(row.get("moment")),
            "source_updated_at": _safe_datetime(row.get("updated")),
            "state_name": _safe_text(state.get("name")),
            "organization_name": _safe_text(organization.get("name")),
            "agent_name": _safe_text(agent.get("name")),
            "agent_email": _safe_text(agent.get("email")),
            "agent_phone": _safe_text(agent.get("phone")),
            "sum_total": _to_money(row.get("sum")),
            "sum_paid": _to_money(row.get("payedSum")),
        }

    def handle(self, *args, **options):
        page_size = max(1, min(int(options["page_size"]), 1000))
        max_pages = max(0, int(options["max_pages"]))
        full_refresh = bool(options["full_refresh"])

        try:
            client = MoySkladClient()
        except MoySkladConfigError as exc:
            raise CommandError(str(exc)) from exc

        checkpoint, _ = SyncCheckpoint.objects.using(self.analytics_alias).get_or_create(
            entity=self.entity
        )
        filter_expr = ""
        if not full_refresh:
            filter_expr = self._build_filter_expr(checkpoint.last_synced_at)

        self.stdout.write(
            f"Старт sync в '{self.analytics_alias}' для {self.entity}. "
            f"page_size={page_size}, filter={'on' if filter_expr else 'off'}"
        )

        stats = {
            "pages": 0,
            "rows_seen": 0,
            "raw_created": 0,
            "raw_updated": 0,
            "clean_created": 0,
            "clean_updated": 0,
            "skipped_without_id": 0,
        }
        filter_fallback_used = False

        offset = 0
        max_source_updated_at = checkpoint.last_synced_at

        try:
            while True:
                try:
                    payload = client.get_customer_orders(
                        limit=page_size,
                        offset=offset,
                        filter_expr=filter_expr,
                        expand="state,organization,agent",
                    )
                except MoySkladError:
                    if filter_expr and offset == 0 and not filter_fallback_used:
                        filter_expr = ""
                        filter_fallback_used = True
                        self.stdout.write(
                            self.style.WARNING(
                                "Инкрементальный filter не принят API, переключаюсь на полный проход."
                            )
                        )
                        continue
                    raise
                rows = payload.get("rows", []) or []
                if not rows:
                    break

                stats["pages"] += 1
                stats["rows_seen"] += len(rows)

                for row in rows:
                    external_id = _safe_text(row.get("id"))
                    if not external_id:
                        stats["skipped_without_id"] += 1
                        continue

                    row_updated = _safe_datetime(row.get("updated"))
                    if row_updated and (
                        max_source_updated_at is None or row_updated > max_source_updated_at
                    ):
                        max_source_updated_at = row_updated

                    payload_hash = _payload_hash(row)

                    with transaction.atomic(using=self.analytics_alias):
                        _, raw_created = RawMoyskladRecord.objects.using(self.analytics_alias).update_or_create(
                            entity=self.entity,
                            external_id=external_id,
                            defaults={
                                "source_updated_at": row_updated,
                                "payload": row,
                                "payload_hash": payload_hash,
                            },
                        )
                        if raw_created:
                            stats["raw_created"] += 1
                        else:
                            stats["raw_updated"] += 1

                        _, clean_created = MoyskladCustomerOrder.objects.using(self.analytics_alias).update_or_create(
                            external_id=external_id,
                            defaults=self._extract_clean_order(row),
                        )
                        if clean_created:
                            stats["clean_created"] += 1
                        else:
                            stats["clean_updated"] += 1

                self.stdout.write(
                    f"Страница {stats['pages']}: +{len(rows)} строк, "
                    f"raw c/u={stats['raw_created']}/{stats['raw_updated']}, "
                    f"clean c/u={stats['clean_created']}/{stats['clean_updated']}"
                )

                if max_pages and stats["pages"] >= max_pages:
                    self.stdout.write("Остановлено по --max-pages.")
                    break

                if len(rows) < page_size:
                    break
                offset += page_size

        except MoySkladError as exc:
            checkpoint.last_status = "error"
            checkpoint.last_error = _safe_text(exc)
            checkpoint.rows_processed = stats["rows_seen"]
            checkpoint.save(
                using=self.analytics_alias,
                update_fields=["last_status", "last_error", "rows_processed", "last_run_at"],
            )
            raise CommandError(f"Ошибка API МойСклад: {exc}") from exc

        checkpoint.last_status = "success"
        checkpoint.last_error = ""
        checkpoint.rows_processed = stats["rows_seen"]
        if max_source_updated_at:
            checkpoint.last_synced_at = max_source_updated_at
        checkpoint.save(
            using=self.analytics_alias,
            update_fields=[
                "last_status",
                "last_error",
                "rows_processed",
                "last_run_at",
                "last_synced_at",
            ],
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Готово: "
                f"страниц {stats['pages']}, "
                f"строк {stats['rows_seen']}, "
                f"raw created/updated {stats['raw_created']}/{stats['raw_updated']}, "
                f"clean created/updated {stats['clean_created']}/{stats['clean_updated']}, "
                f"пропущено без id {stats['skipped_without_id']}."
            )
        )
