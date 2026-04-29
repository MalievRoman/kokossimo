import hashlib
import json
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from erp_analytics.models import (
    MoyskladCustomerOrder,
    MoyskladOperation,
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
        "(raw + очищенные документы и операции)."
    )

    analytics_alias = "analytics"
    entities = (
        ("customerorder", "order", "get_customer_orders"),
        ("demand", "sale", "get_demands"),
        ("retaildemand", "sale_retail", "get_retail_demands"),
        ("salesreturn", "return", "get_sales_returns"),
    )

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
        parser.add_argument(
            "--from-date",
            type=str,
            default="",
            help="Дата начала выборки (YYYY-MM-DD), например 2025-01-01.",
        )
        parser.add_argument(
            "--to-date",
            type=str,
            default="",
            help="Дата конца выборки (YYYY-MM-DD). По умолчанию сегодня.",
        )

    def _build_filter_expr(self, checkpoint_dt):
        if not checkpoint_dt:
            return ""
        # Формат фильтра подходит для большинства сущностей remap API.
        stamp = checkpoint_dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        return f"updated>{stamp}"

    def _build_date_range_filter(self, from_date, to_date):
        # Для ручного диапазона используем дату документа (moment), а не дату обновления.
        return (
            f"moment>={from_date.isoformat()} 00:00:00;"
            f"moment<={to_date.isoformat()} 23:59:59"
        )

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

    def _extract_clean_operation(self, row, source_entity, operation_type):
        state = row.get("state") or {}
        organization = row.get("organization") or {}
        agent = row.get("agent") or {}
        return {
            "operation_type": operation_type,
            "document_number": _safe_text(row.get("name")),
            "moment": _safe_datetime(row.get("moment")),
            "source_updated_at": _safe_datetime(row.get("updated")),
            "state_name": _safe_text(state.get("name")),
            "organization_name": _safe_text(organization.get("name")),
            "agent_name": _safe_text(agent.get("name")),
            "agent_email": _safe_text(agent.get("email")),
            "agent_phone": _safe_text(agent.get("phone")),
            "sum_total": _to_money(row.get("sum")),
            "sum_paid": _to_money(row.get("payedSum")),
            "source_entity": source_entity,
        }

    def _sync_entity(
        self,
        client,
        entity_name,
        operation_type,
        fetcher_name,
        page_size,
        max_pages,
        full_refresh,
        from_date=None,
        to_date=None,
    ):
        checkpoint, _ = SyncCheckpoint.objects.using(self.analytics_alias).get_or_create(
            entity=entity_name
        )
        filter_expr = ""
        resume_mode = bool(from_date and to_date)
        start_offset = 0
        if from_date and to_date:
            filter_expr = self._build_date_range_filter(from_date, to_date)
            if (
                checkpoint.resume_active
                and checkpoint.resume_filter_from == from_date
                and checkpoint.resume_filter_to == to_date
                and checkpoint.resume_next_offset > 0
            ):
                start_offset = int(checkpoint.resume_next_offset)
                self.stdout.write(
                    self.style.WARNING(
                        f"[{entity_name}] продолжаю с offset={start_offset} "
                        f"для диапазона {from_date}..{to_date}"
                    )
                )
            else:
                checkpoint.resume_filter_from = from_date
                checkpoint.resume_filter_to = to_date
                checkpoint.resume_next_offset = 0
                checkpoint.resume_active = True
        elif not full_refresh:
            filter_expr = self._build_filter_expr(checkpoint.last_synced_at)
            checkpoint.resume_filter_from = None
            checkpoint.resume_filter_to = None
            checkpoint.resume_next_offset = 0
            checkpoint.resume_active = False
        else:
            checkpoint.resume_filter_from = None
            checkpoint.resume_filter_to = None
            checkpoint.resume_next_offset = 0
            checkpoint.resume_active = False

        checkpoint.last_status = "running"
        checkpoint.last_error = ""
        checkpoint.save(
            using=self.analytics_alias,
            update_fields=[
                "last_status",
                "last_error",
                "last_run_at",
                "resume_filter_from",
                "resume_filter_to",
                "resume_next_offset",
                "resume_active",
            ],
        )

        stats = {
            "pages": 0,
            "rows_seen": 0,
            "raw_created": 0,
            "raw_updated": 0,
            "orders_created": 0,
            "orders_updated": 0,
            "operations_created": 0,
            "operations_updated": 0,
            "skipped_without_id": 0,
        }
        filter_fallback_used = False
        max_source_updated_at = checkpoint.last_synced_at
        offset = start_offset

        fetcher = getattr(client, fetcher_name)
        try:
            while True:
                try:
                    payload = fetcher(
                        limit=page_size,
                        offset=offset,
                        filter_expr=filter_expr,
                        expand="state,organization,agent",
                    )
                except MoySkladError:
                    if filter_expr and offset == 0 and not filter_fallback_used and not from_date:
                        filter_expr = ""
                        filter_fallback_used = True
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{entity_name}] инкрементальный filter не принят API, "
                                "переключаюсь на полный проход."
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
                            entity=entity_name,
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

                        if entity_name == "customerorder":
                            _, order_created = MoyskladCustomerOrder.objects.using(self.analytics_alias).update_or_create(
                                external_id=external_id,
                                defaults=self._extract_clean_order(row),
                            )
                            if order_created:
                                stats["orders_created"] += 1
                            else:
                                stats["orders_updated"] += 1

                        _, op_created = MoyskladOperation.objects.using(self.analytics_alias).update_or_create(
                            source_entity=entity_name,
                            external_id=external_id,
                            defaults=self._extract_clean_operation(row, entity_name, operation_type),
                        )
                        if op_created:
                            stats["operations_created"] += 1
                        else:
                            stats["operations_updated"] += 1

                self.stdout.write(
                    f"[{entity_name}] стр. {stats['pages']}: +{len(rows)} строк, "
                    f"raw c/u={stats['raw_created']}/{stats['raw_updated']}, "
                    f"ops c/u={stats['operations_created']}/{stats['operations_updated']}"
                )
                next_offset = offset + len(rows)
                checkpoint.rows_processed = stats["rows_seen"]
                checkpoint.resume_next_offset = next_offset if resume_mode else 0
                checkpoint.resume_active = bool(resume_mode)
                checkpoint.save(
                    using=self.analytics_alias,
                    update_fields=[
                        "rows_processed",
                        "last_run_at",
                        "resume_next_offset",
                        "resume_active",
                    ],
                )

                if max_pages and stats["pages"] >= max_pages:
                    self.stdout.write(f"[{entity_name}] остановлено по --max-pages.")
                    break
                if len(rows) < page_size:
                    break
                offset = next_offset
        except MoySkladError as exc:
            checkpoint.last_status = "error"
            checkpoint.last_error = _safe_text(exc)
            checkpoint.rows_processed = stats["rows_seen"]
            checkpoint.resume_active = bool(resume_mode)
            checkpoint.resume_next_offset = offset
            checkpoint.save(
                using=self.analytics_alias,
                update_fields=[
                    "last_status",
                    "last_error",
                    "rows_processed",
                    "last_run_at",
                    "resume_active",
                    "resume_next_offset",
                ],
            )
            raise

        checkpoint.last_status = "success"
        checkpoint.last_error = ""
        checkpoint.rows_processed = stats["rows_seen"]
        checkpoint.resume_active = False
        checkpoint.resume_next_offset = 0
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
                "resume_active",
                "resume_next_offset",
            ],
        )
        return stats

    def handle(self, *args, **options):
        page_size = max(1, min(int(options["page_size"]), 1000))
        max_pages = max(0, int(options["max_pages"]))
        full_refresh = bool(options["full_refresh"])
        from_date_str = _safe_text(options["from_date"])
        to_date_str = _safe_text(options["to_date"])

        try:
            client = MoySkladClient()
        except MoySkladConfigError as exc:
            raise CommandError(str(exc)) from exc
        from_date = None
        to_date = None
        if from_date_str:
            try:
                from_date = date.fromisoformat(from_date_str)
            except ValueError as exc:
                raise CommandError(f"Некорректный --from-date: {from_date_str}") from exc

            if to_date_str:
                try:
                    to_date = date.fromisoformat(to_date_str)
                except ValueError as exc:
                    raise CommandError(f"Некорректный --to-date: {to_date_str}") from exc
            else:
                to_date = timezone.localdate()

            if from_date > to_date:
                raise CommandError("--from-date не может быть позже --to-date.")

        self.stdout.write(
            f"Старт sync в '{self.analytics_alias}': page_size={page_size}, "
            f"entities={', '.join(entity for entity, _, _ in self.entities)}"
        )
        if from_date and to_date:
            self.stdout.write(f"Диапазон дат: {from_date.isoformat()}..{to_date.isoformat()}")

        total_stats = {
            "pages": 0,
            "rows_seen": 0,
            "raw_created": 0,
            "raw_updated": 0,
            "orders_created": 0,
            "orders_updated": 0,
            "operations_created": 0,
            "operations_updated": 0,
            "skipped_without_id": 0,
        }
        try:
            for entity_name, operation_type, fetcher_name in self.entities:
                entity_stats = self._sync_entity(
                    client=client,
                    entity_name=entity_name,
                    operation_type=operation_type,
                    fetcher_name=fetcher_name,
                    page_size=page_size,
                    max_pages=max_pages,
                    full_refresh=full_refresh,
                    from_date=from_date,
                    to_date=to_date,
                )
                for key in total_stats:
                    total_stats[key] += entity_stats.get(key, 0)

        except MoySkladError as exc:
            raise CommandError(f"Ошибка API МойСклад: {exc}") from exc

        self.stdout.write(
            self.style.SUCCESS(
                "Готово: "
                f"страниц {total_stats['pages']}, "
                f"строк {total_stats['rows_seen']}, "
                f"raw created/updated {total_stats['raw_created']}/{total_stats['raw_updated']}, "
                f"orders created/updated {total_stats['orders_created']}/{total_stats['orders_updated']}, "
                f"operations created/updated {total_stats['operations_created']}/{total_stats['operations_updated']}, "
                f"пропущено без id {total_stats['skipped_without_id']}."
            )
        )
