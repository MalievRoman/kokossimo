import csv
import json
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from shop.moysklad import MoySkladClient, MoySkladConfigError, MoySkladError


def _as_str(value):
    if value is None:
        return ""
    return str(value).strip()


def _to_money(raw_value):
    if raw_value is None:
        return Decimal("0.00")
    try:
        return (Decimal(str(raw_value)) / Decimal("100")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def _to_decimal(value, default="0"):
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _date_chunks(start_date, end_date, chunk_days):
    current = start_date
    while current <= end_date:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end_date)
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)


class Command(BaseCommand):
    help = (
        "Выгружает единый журнал товарных операций из МойСклад "
        "(заказы, продажи, розничные продажи, возвраты) в CSV/JSONL."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--from-date",
            type=str,
            default="",
            help="Дата начала выгрузки (YYYY-MM-DD). Если не указана и задан --all-history, берется 2000-01-01.",
        )
        parser.add_argument(
            "--to-date",
            type=str,
            default="",
            help="Дата конца выгрузки (YYYY-MM-DD). По умолчанию сегодня.",
        )
        parser.add_argument(
            "--all-history",
            action="store_true",
            help="Выгрузить с максимально ранней даты (2000-01-01) до to-date/сегодня.",
        )
        parser.add_argument(
            "--chunk-days",
            type=int,
            default=30,
            help="Размер окна выборки в днях (по умолчанию 30).",
        )
        parser.add_argument(
            "--page-size",
            type=int,
            default=100,
            help="Размер страницы API (1..1000). По умолчанию 100.",
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            default="",
            help="Папка для файлов выгрузки. По умолчанию: ../analytics относительно backend.",
        )

    def _parse_dates(self, options):
        to_date_str = _as_str(options["to_date"])
        from_date_str = _as_str(options["from_date"])
        all_history = bool(options["all_history"])
        today = date.today()

        if to_date_str:
            try:
                end_date = date.fromisoformat(to_date_str)
            except ValueError as exc:
                raise CommandError(f"Некорректный --to-date: {to_date_str}") from exc
        else:
            end_date = today

        if from_date_str:
            try:
                start_date = date.fromisoformat(from_date_str)
            except ValueError as exc:
                raise CommandError(f"Некорректный --from-date: {from_date_str}") from exc
        elif all_history:
            start_date = date(2000, 1, 1)
        else:
            raise CommandError("Укажите --from-date YYYY-MM-DD или используйте --all-history.")

        if start_date > end_date:
            raise CommandError("--from-date не может быть позже --to-date.")

        return start_date, end_date

    def _get_row_timestamp(self, row):
        return _as_str(row.get("moment") or row.get("updated") or row.get("created"))

    def _agent_data(self, row):
        agent = row.get("agent") or {}
        return {
            "customer_id": _as_str(agent.get("id")),
            "customer_name": _as_str(agent.get("name")),
            "customer_email": _as_str(agent.get("email")),
            "customer_phone": _as_str(agent.get("phone")),
        }

    def _extract_positions(self, row):
        positions = row.get("positions") or {}
        return positions.get("rows") or []

    def _line_total(self, position, qty):
        if position.get("sum") is not None:
            return _to_money(position.get("sum"))
        return (_to_money(position.get("price")) * qty).quantize(Decimal("0.01"))

    def _operation_rows(self, source_name, operation_type, row, sign=1):
        document_id = _as_str(row.get("id"))
        document_number = _as_str(row.get("name"))
        document_moment = self._get_row_timestamp(row)
        state = _as_str((row.get("state") or {}).get("name"))
        organization_name = _as_str((row.get("organization") or {}).get("name"))
        customer = self._agent_data(row)

        result = []
        for position in self._extract_positions(row):
            qty = _to_decimal(position.get("quantity"), default="0")
            qty = qty * Decimal(sign)

            price = _to_money(position.get("price"))
            discount = _as_str(position.get("discount"))
            line_total = self._line_total(position, _to_decimal(position.get("quantity"), default="0"))
            line_total = (line_total * Decimal(sign)).quantize(Decimal("0.01"))

            assortment = position.get("assortment") or {}
            result.append(
                {
                    "event_datetime": document_moment,
                    "operation_type": operation_type,
                    "source_entity": source_name,
                    "document_id": document_id,
                    "document_number": document_number,
                    "document_state": state,
                    "organization_name": organization_name,
                    "customer_id": customer["customer_id"],
                    "customer_name": customer["customer_name"],
                    "customer_email": customer["customer_email"],
                    "customer_phone": customer["customer_phone"],
                    "item_id": _as_str(position.get("id")),
                    "product_id": _as_str(assortment.get("id")),
                    "product_name": _as_str(assortment.get("name")),
                    "quantity": str(qty),
                    "price": str(price),
                    "discount": discount,
                    "line_total": str(line_total),
                }
            )
        return result

    def handle(self, *args, **options):
        start_date, end_date = self._parse_dates(options)
        chunk_days = max(1, int(options["chunk_days"]))
        page_size = max(1, min(int(options["page_size"]), 1000))

        try:
            client = MoySkladClient()
        except MoySkladConfigError as exc:
            raise CommandError(str(exc))

        backend_dir = Path(__file__).resolve().parents[3]
        repo_dir = backend_dir.parent
        default_output_dir = (repo_dir / "analytics").resolve()
        output_dir = Path(options["output_dir"]).resolve() if _as_str(options["output_dir"]) else default_output_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_dir = output_dir / f"moysklad_operations_{ts}"
        run_dir.mkdir(parents=True, exist_ok=True)

        operations_csv_path = run_dir / "operations_all.csv"
        raw_jsonl_path = run_dir / "operations_raw.jsonl"
        manifest_path = run_dir / "manifest.json"

        self.stdout.write(
            f"Старт выгрузки операций МойСклад: {start_date.isoformat()} -> {end_date.isoformat()}, "
            f"chunk_days={chunk_days}, page_size={page_size}"
        )
        self.stdout.write(f"Папка выгрузки: {run_dir}")

        entities = [
            {
                "name": "customerorder",
                "operation_type": "order",
                "fetcher": client.get_customer_orders,
                "sign": 1,
            },
            {
                "name": "demand",
                "operation_type": "sale",
                "fetcher": client.get_demands,
                "sign": 1,
            },
            {
                "name": "retaildemand",
                "operation_type": "sale_retail",
                "fetcher": client.get_retail_demands,
                "sign": 1,
            },
            {
                "name": "salesreturn",
                "operation_type": "return",
                "fetcher": client.get_sales_returns,
                "sign": -1,
            },
        ]

        stats = {
            "date_from": start_date.isoformat(),
            "date_to": end_date.isoformat(),
            "chunks_total": 0,
            "chunks_done": 0,
            "documents_total": 0,
            "operations_total": 0,
            "documents_by_entity": {entity["name"]: 0 for entity in entities},
            "operations_by_type": {entity["operation_type"]: 0 for entity in entities},
        }

        chunks = list(_date_chunks(start_date, end_date, chunk_days))
        stats["chunks_total"] = len(chunks)

        with (
            operations_csv_path.open("w", encoding="utf-8-sig", newline="") as operations_file,
            raw_jsonl_path.open("w", encoding="utf-8") as raw_file,
        ):
            writer = csv.DictWriter(
                operations_file,
                fieldnames=[
                    "event_datetime",
                    "operation_type",
                    "source_entity",
                    "document_id",
                    "document_number",
                    "document_state",
                    "organization_name",
                    "customer_id",
                    "customer_name",
                    "customer_email",
                    "customer_phone",
                    "item_id",
                    "product_id",
                    "product_name",
                    "quantity",
                    "price",
                    "discount",
                    "line_total",
                ],
            )
            writer.writeheader()

            for idx, (chunk_start, chunk_end) in enumerate(chunks, start=1):
                filter_expr = (
                    f"moment>={chunk_start.isoformat()} 00:00:00;"
                    f"moment<={chunk_end.isoformat()} 23:59:59"
                )
                chunk_docs = 0
                chunk_ops = 0

                for entity in entities:
                    offset = 0
                    while True:
                        try:
                            payload = entity["fetcher"](
                                limit=page_size,
                                offset=offset,
                                filter_expr=filter_expr,
                                expand="positions,agent,state,organization",
                            )
                        except MoySkladError as exc:
                            raise CommandError(
                                f"Ошибка API {entity['name']} на окне {chunk_start}..{chunk_end}: {exc}"
                            ) from exc

                        rows = payload.get("rows", []) or []
                        if not rows:
                            break

                        for row in rows:
                            raw_file.write(
                                json.dumps(
                                    {
                                        "source_entity": entity["name"],
                                        "operation_type": entity["operation_type"],
                                        "payload": row,
                                    },
                                    ensure_ascii=False,
                                )
                                + "\n"
                            )
                            stats["documents_total"] += 1
                            stats["documents_by_entity"][entity["name"]] += 1
                            chunk_docs += 1

                            operation_rows = self._operation_rows(
                                source_name=entity["name"],
                                operation_type=entity["operation_type"],
                                row=row,
                                sign=entity["sign"],
                            )
                            for operation in operation_rows:
                                writer.writerow(operation)
                                stats["operations_total"] += 1
                                stats["operations_by_type"][entity["operation_type"]] += 1
                                chunk_ops += 1

                        if len(rows) < page_size:
                            break
                        offset += page_size

                stats["chunks_done"] += 1
                self.stdout.write(
                    f"[{idx}/{stats['chunks_total']}] {chunk_start.isoformat()}..{chunk_end.isoformat()} "
                    f"-> документов: {chunk_docs}, операций: {chunk_ops}, всего операций: {stats['operations_total']}"
                )

        with manifest_path.open("w", encoding="utf-8") as manifest_file:
            json.dump(
                {
                    "generated_at": datetime.now().isoformat(timespec="seconds"),
                    "run_dir": str(run_dir),
                    "files": {
                        "operations_csv": str(operations_csv_path),
                        "raw_jsonl": str(raw_jsonl_path),
                    },
                    "stats": stats,
                },
                manifest_file,
                ensure_ascii=False,
                indent=2,
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Готово: "
                f"документов {stats['documents_total']}, "
                f"операций {stats['operations_total']}.\n"
                f"Результаты: {run_dir}"
            )
        )
