import csv
import json
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from shop.moysklad import MoySkladClient, MoySkladConfigError, MoySkladError


def _to_money(raw_value):
    if raw_value is None:
        return Decimal("0.00")
    try:
        return (Decimal(str(raw_value)) / Decimal("100")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def _as_str(value):
    if value is None:
        return ""
    return str(value).strip()


def _state_name(row):
    state = row.get("state") or {}
    if isinstance(state, dict):
        return _as_str(state.get("name"))
    return ""


def _is_paid_order(row):
    if _to_money(row.get("payedSum")) > 0:
        return True
    name = _state_name(row).lower()
    return any(word in name for word in ("оплачен", "закрыт", "выполнен", "paid", "closed"))


def _date_chunks(start_date, end_date, chunk_days):
    current = start_date
    while current <= end_date:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end_date)
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)


class Command(BaseCommand):
    help = "Выгружает продажи (customer orders) из МойСклад в raw JSONL и CSV для аналитики."

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

    def handle(self, *args, **options):
        to_date_str = _as_str(options["to_date"])
        from_date_str = _as_str(options["from_date"])
        all_history = bool(options["all_history"])
        chunk_days = max(1, int(options["chunk_days"]))
        page_size = max(1, min(int(options["page_size"]), 1000))

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
        run_dir = output_dir / f"moysklad_sales_{ts}"
        run_dir.mkdir(parents=True, exist_ok=True)

        raw_jsonl_path = run_dir / "orders_raw.jsonl"
        orders_csv_path = run_dir / "orders_all.csv"
        paid_orders_csv_path = run_dir / "orders_paid.csv"
        items_csv_path = run_dir / "order_items.csv"
        manifest_path = run_dir / "manifest.json"

        self.stdout.write(
            f"Старт выгрузки заказов МойСклад: {start_date.isoformat()} -> {end_date.isoformat()}, "
            f"chunk_days={chunk_days}, page_size={page_size}"
        )
        self.stdout.write(f"Папка выгрузки: {run_dir}")

        stats = {
            "date_from": start_date.isoformat(),
            "date_to": end_date.isoformat(),
            "chunks_total": 0,
            "chunks_done": 0,
            "orders_total": 0,
            "orders_paid": 0,
            "order_items_total": 0,
        }

        with (
            raw_jsonl_path.open("w", encoding="utf-8") as raw_file,
            orders_csv_path.open("w", encoding="utf-8-sig", newline="") as orders_file,
            paid_orders_csv_path.open("w", encoding="utf-8-sig", newline="") as paid_orders_file,
            items_csv_path.open("w", encoding="utf-8-sig", newline="") as items_file,
        ):
            orders_writer = csv.DictWriter(
                orders_file,
                fieldnames=[
                    "order_id",
                    "order_number",
                    "moment",
                    "updated",
                    "state",
                    "sum_total",
                    "sum_paid",
                    "organization_name",
                    "agent_id",
                    "agent_name",
                    "agent_email",
                    "agent_phone",
                ],
            )
            paid_orders_writer = csv.DictWriter(
                paid_orders_file,
                fieldnames=[
                    "order_id",
                    "order_number",
                    "moment",
                    "updated",
                    "state",
                    "sum_total",
                    "sum_paid",
                    "organization_name",
                    "agent_id",
                    "agent_name",
                    "agent_email",
                    "agent_phone",
                ],
            )
            items_writer = csv.DictWriter(
                items_file,
                fieldnames=[
                    "order_id",
                    "order_number",
                    "item_id",
                    "product_id",
                    "product_name",
                    "quantity",
                    "price",
                    "discount",
                    "line_total",
                ],
            )

            orders_writer.writeheader()
            paid_orders_writer.writeheader()
            items_writer.writeheader()

            chunks = list(_date_chunks(start_date, end_date, chunk_days))
            stats["chunks_total"] = len(chunks)

            for idx, (chunk_start, chunk_end) in enumerate(chunks, start=1):
                filter_expr = (
                    f"moment>={chunk_start.isoformat()} 00:00:00;"
                    f"moment<={chunk_end.isoformat()} 23:59:59"
                )
                offset = 0
                chunk_orders = 0

                while True:
                    try:
                        payload = client.get_customer_orders(
                            limit=page_size,
                            offset=offset,
                            filter_expr=filter_expr,
                            expand="positions,agent,state,organization",
                        )
                    except MoySkladError as exc:
                        raise CommandError(f"Ошибка API на окне {chunk_start}..{chunk_end}: {exc}") from exc

                    rows = payload.get("rows", []) or []
                    if not rows:
                        break

                    for row in rows:
                        raw_file.write(json.dumps(row, ensure_ascii=False) + "\n")

                        order_id = _as_str(row.get("id"))
                        order_number = _as_str(row.get("name"))
                        moment = _as_str(row.get("moment"))
                        updated = _as_str(row.get("updated"))
                        state = _state_name(row)
                        sum_total = _to_money(row.get("sum"))
                        sum_paid = _to_money(row.get("payedSum"))

                        organization = row.get("organization") or {}
                        organization_name = _as_str(organization.get("name"))

                        agent = row.get("agent") or {}
                        agent_id = _as_str(agent.get("id"))
                        agent_name = _as_str(agent.get("name"))
                        agent_email = _as_str(agent.get("email"))
                        agent_phone = _as_str(agent.get("phone"))

                        order_record = {
                            "order_id": order_id,
                            "order_number": order_number,
                            "moment": moment,
                            "updated": updated,
                            "state": state,
                            "sum_total": str(sum_total),
                            "sum_paid": str(sum_paid),
                            "organization_name": organization_name,
                            "agent_id": agent_id,
                            "agent_name": agent_name,
                            "agent_email": agent_email,
                            "agent_phone": agent_phone,
                        }
                        orders_writer.writerow(order_record)
                        stats["orders_total"] += 1
                        chunk_orders += 1

                        if _is_paid_order(row):
                            paid_orders_writer.writerow(order_record)
                            stats["orders_paid"] += 1

                        positions = row.get("positions") or {}
                        position_rows = positions.get("rows") or []
                        for pos in position_rows:
                            quantity = _as_str(pos.get("quantity"))
                            price = _to_money(pos.get("price"))
                            discount = _as_str(pos.get("discount"))
                            line_total = _to_money(pos.get("price")) * Decimal(quantity or "0")

                            assortment = pos.get("assortment") or {}
                            items_writer.writerow(
                                {
                                    "order_id": order_id,
                                    "order_number": order_number,
                                    "item_id": _as_str(pos.get("id")),
                                    "product_id": _as_str(assortment.get("id")),
                                    "product_name": _as_str(assortment.get("name")),
                                    "quantity": quantity,
                                    "price": str(price),
                                    "discount": discount,
                                    "line_total": str(line_total.quantize(Decimal("0.01"))),
                                }
                            )
                            stats["order_items_total"] += 1

                    if len(rows) < page_size:
                        break
                    offset += page_size

                stats["chunks_done"] += 1
                self.stdout.write(
                    f"[{idx}/{stats['chunks_total']}] {chunk_start.isoformat()}..{chunk_end.isoformat()} "
                    f"-> заказов: {chunk_orders}, всего: {stats['orders_total']}"
                )

        with manifest_path.open("w", encoding="utf-8") as manifest_file:
            json.dump(
                {
                    "generated_at": datetime.now().isoformat(timespec="seconds"),
                    "run_dir": str(run_dir),
                    "files": {
                        "raw_jsonl": str(raw_jsonl_path),
                        "orders_all_csv": str(orders_csv_path),
                        "orders_paid_csv": str(paid_orders_csv_path),
                        "order_items_csv": str(items_csv_path),
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
                f"заказов всего {stats['orders_total']}, "
                f"оплаченных/закрытых {stats['orders_paid']}, "
                f"позиций {stats['order_items_total']}.\n"
                f"Результаты: {run_dir}"
            )
        )
