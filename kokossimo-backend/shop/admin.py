"""
Админ-панель для сотрудников магазина Kokossimo.
Русский интерфейс задаётся в config/urls.py.
"""
from django.contrib import admin
from django.contrib import messages
from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.urls import path, reverse
from django.utils.html import format_html
import threading
import time
from .models import (
    Category,
    Product,
    ProductSubcategory,
    Profile,
    Order,
    OrderItem,
    ProductRating,
    Feedback,
    SyncLog,
    SavedDeliveryAddress,
    Certificate,
)
from .moysklad import MoySkladConfigError, MoySkladError
from .moysklad_sync import sync_product_stocks, sync_single_product, sync_site_products, SyncStoppedError

_MAX_SYNC_LOG_OUTPUT_CHARS = 200000


def _append_sync_log_output(sync_log_id, message):
    line = str(message or "").strip()
    if not line:
        return
    timestamp = time.strftime("%H:%M:%S")
    chunk = f"[{timestamp}] {line}\n"
    sync_log = SyncLog.objects.filter(id=sync_log_id).only("id", "log_output").first()
    if not sync_log:
        return
    combined = f"{sync_log.log_output}{chunk}"
    if len(combined) > _MAX_SYNC_LOG_OUTPUT_CHARS:
        combined = combined[-_MAX_SYNC_LOG_OUTPUT_CHARS:]
    sync_log.log_output = combined
    sync_log.save(update_fields=["log_output"])


def _build_stop_checker(sync_log_id):
    state = {"last_check": 0.0, "stop_requested": False}

    def should_stop():
        if state["stop_requested"]:
            return True
        now = time.monotonic()
        if now - state["last_check"] < 1.0:
            return False
        state["last_check"] = now
        state["stop_requested"] = SyncLog.objects.filter(id=sync_log_id, stop_requested=True).exists()
        return state["stop_requested"]

    return should_stop


def _run_sync_in_background(sync_log, target):
    def worker():
        try:
            target()
        except SyncStoppedError:
            pass
        except Exception as exc:
            SyncLog.objects.filter(id=sync_log.id).update(status="error", error=str(exc))
            _append_sync_log_output(sync_log.id, f"Ошибка: {exc}")

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    list_per_page = 25
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("name", "slug")}),
        ("Изображение", {"fields": ("image",)}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # В режиме синка МойСклад на сайте используется одна категория (site-kokossimo),
        # остальные категории в админке не актуальны для витрины.
        if getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            qs = qs.filter(slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo"))
        return qs


@admin.register(ProductSubcategory)
class ProductSubcategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "parent_code")
    list_filter = ("parent_code",)
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(SavedDeliveryAddress)
class SavedDeliveryAddressAdmin(admin.ModelAdmin):
    list_display = ("user", "city", "street_house", "apartment_office", "updated_at")
    list_filter = ("city", "updated_at", "created_at")
    search_fields = ("user__username", "user__email", "city", "street_house", "apartment_office", "comment")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    change_list_template = "admin/shop/product/change_list.html"
    change_form_template = "admin/shop/product/change_form.html"
    list_display = ("name", "price", "stock", "category", "product_subcategory", "is_new", "is_bestseller", "discount", "created_at")
    list_filter = ("category", "product_subcategory", "is_new", "is_bestseller")
    search_fields = ("name", "description")
    list_editable = ("price", "stock", "is_new", "is_bestseller", "discount")
    list_per_page = 25
    date_hierarchy = "created_at"
    autocomplete_fields = ("category", "product_subcategory")
    fieldsets = (
        (None, {"fields": ("name", "category", "product_subcategory", "description", "composition", "usage_instructions", "price", "image")}),
        ("Главная страница", {"fields": ("is_bestseller", "is_new", "discount")}),
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "category" and getattr(settings, "MOYSKLAD_SITE_SYNC_ENABLED", False):
            kwargs["queryset"] = Category.objects.filter(
                slug=getattr(settings, "MOYSKLAD_SITE_CATEGORY_SLUG", "site-kokossimo")
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("sync/full/", self.admin_site.admin_view(self.sync_full_view), name="shop_product_sync_full"),
            path("sync/full-no-openai/", self.admin_site.admin_view(self.sync_full_no_openai_view), name="shop_product_sync_full_no_openai"),
            path("sync/stocks/", self.admin_site.admin_view(self.sync_stocks_view), name="shop_product_sync_stocks"),
            path("<path:object_id>/resync/", self.admin_site.admin_view(self.resync_single_product_view), name="shop_product_resync"),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["sync_full_url"] = reverse("admin:shop_product_sync_full")
        extra_context["sync_full_no_openai_url"] = reverse("admin:shop_product_sync_full_no_openai")
        extra_context["sync_stocks_url"] = reverse("admin:shop_product_sync_stocks")
        return super().changelist_view(request, extra_context=extra_context)

    def change_view(self, request, object_id, form_url="", extra_context=None):
        extra_context = extra_context or {}
        extra_context["sync_single_url"] = reverse("admin:shop_product_resync", args=[object_id])
        return super().change_view(request, object_id, form_url=form_url, extra_context=extra_context)

    def _redirect_to_changelist(self):
        return HttpResponseRedirect(reverse("admin:shop_product_changelist"))

    def _start_sync_job(self, request, operation, target):
        sync_log = SyncLog.objects.create(
            operation=operation,
            status="running",
            source="admin",
            initiated_by=getattr(request.user, "username", ""),
        )
        _append_sync_log_output(sync_log.id, "Задача синхронизации запущена.")
        _run_sync_in_background(sync_log, target(sync_log))
        self.message_user(
            request,
            f"Синхронизация запущена в фоне. Лог #{sync_log.id}.",
            level=messages.INFO,
        )
        return HttpResponseRedirect(reverse("admin:shop_synclog_monitor", args=[sync_log.id]))

    def sync_full_view(self, request):
        def target(sync_log):
            def run():
                should_stop = _build_stop_checker(sync_log.id)
                sync_site_products(
                    force=True,
                    run_openai_enrichment=True,
                    sync_source="admin",
                    initiated_by=getattr(request.user, "username", ""),
                    progress_callback=lambda msg: _append_sync_log_output(sync_log.id, msg),
                    should_stop=should_stop,
                    sync_log=sync_log,
                )
            return run

        return self._start_sync_job(request, "full_sync", target)

    def sync_full_no_openai_view(self, request):
        def target(sync_log):
            def run():
                should_stop = _build_stop_checker(sync_log.id)
                sync_site_products(
                    force=True,
                    run_openai_enrichment=False,
                    sync_source="admin",
                    initiated_by=getattr(request.user, "username", ""),
                    progress_callback=lambda msg: _append_sync_log_output(sync_log.id, msg),
                    should_stop=should_stop,
                    sync_log=sync_log,
                )
            return run

        return self._start_sync_job(request, "full_sync_no_openai", target)

    def sync_stocks_view(self, request):
        def target(sync_log):
            def run():
                should_stop = _build_stop_checker(sync_log.id)
                sync_product_stocks(
                    sync_source="admin",
                    initiated_by=getattr(request.user, "username", ""),
                    progress_callback=lambda msg: _append_sync_log_output(sync_log.id, msg),
                    should_stop=should_stop,
                    sync_log=sync_log,
                )
            return run

        return self._start_sync_job(request, "stock_sync", target)

    def resync_single_product_view(self, request, object_id):
        product = self.get_object(request, object_id)
        if product is None:
            self.message_user(request, "Товар не найден.", level=messages.ERROR)
            return self._redirect_to_changelist()
        sync_log = SyncLog.objects.create(
            operation="single_product_sync",
            status="running",
            source="admin",
            initiated_by=getattr(request.user, "username", ""),
            target_product=product,
        )
        _append_sync_log_output(sync_log.id, f"Запущена пересинхронизация товара ID={product.id}.")

        def run():
            should_stop = _build_stop_checker(sync_log.id)
            sync_single_product(
                product,
                run_openai_enrichment=False,
                sync_source="admin",
                initiated_by=getattr(request.user, "username", ""),
                progress_callback=lambda msg: _append_sync_log_output(sync_log.id, msg),
                should_stop=should_stop,
                sync_log=sync_log,
            )

        _run_sync_in_background(sync_log, run)
        self.message_user(request, f"Пересинхронизация запущена. Лог #{sync_log.id}.", level=messages.INFO)
        return HttpResponseRedirect(reverse("admin:shop_synclog_monitor", args=[sync_log.id]))


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = (
        "started_at",
        "operation",
        "status",
        "source",
        "initiated_by",
        "target_product",
        "view_live_log",
        "updated_count",
        "errors_count",
    )
    list_filter = ("operation", "status", "source", "started_at")
    search_fields = ("initiated_by", "target_product__name", "error")
    readonly_fields = (
        "operation",
        "status",
        "source",
        "initiated_by",
        "target_product",
        "stats",
        "log_output",
        "stop_requested",
        "error",
        "started_at",
        "finished_at",
        "duration_ms",
    )
    list_per_page = 30
    date_hierarchy = "started_at"

    def has_add_permission(self, request):
        return False

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("<path:object_id>/monitor/", self.admin_site.admin_view(self.monitor_view), name="shop_synclog_monitor"),
            path("<path:object_id>/stream/", self.admin_site.admin_view(self.stream_view), name="shop_synclog_stream"),
            path("<path:object_id>/stop/", self.admin_site.admin_view(self.stop_view), name="shop_synclog_stop"),
        ]
        return custom_urls + urls

    def updated_count(self, obj):
        stats = obj.stats or {}
        return stats.get("updated", stats.get("created", 0))

    updated_count.short_description = "Обновлено"

    def errors_count(self, obj):
        stats = obj.stats or {}
        return stats.get("errors", 1 if obj.error else 0)

    errors_count.short_description = "Ошибки"

    def view_live_log(self, obj):
        url = reverse("admin:shop_synclog_monitor", args=[obj.id])
        return format_html('<a href="{}">Открыть</a>', url)

    view_live_log.short_description = "Монитор"

    def monitor_view(self, request, object_id):
        sync_log = self.get_object(request, object_id)
        if not sync_log:
            return HttpResponseRedirect(reverse("admin:shop_synclog_changelist"))
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "original": sync_log,
            "sync_log": sync_log,
            "stream_url": reverse("admin:shop_synclog_stream", args=[sync_log.id]),
            "stop_url": reverse("admin:shop_synclog_stop", args=[sync_log.id]),
            "title": f"Монитор синка #{sync_log.id}",
        }
        return render(request, "admin/shop/synclog/monitor.html", context)

    def stream_view(self, request, object_id):
        sync_log = self.get_object(request, object_id)
        if not sync_log:
            return JsonResponse({"detail": "not_found"}, status=404)
        return JsonResponse(
            {
                "id": sync_log.id,
                "status": sync_log.status,
                "log_output": sync_log.log_output or "",
                "error": sync_log.error or "",
                "stats": sync_log.stats or {},
                "stop_requested": bool(sync_log.stop_requested),
                "started_at": sync_log.started_at.isoformat() if sync_log.started_at else None,
                "finished_at": sync_log.finished_at.isoformat() if sync_log.finished_at else None,
                "duration_ms": sync_log.duration_ms,
            }
        )

    def stop_view(self, request, object_id):
        if request.method != "POST":
            return HttpResponseRedirect(reverse("admin:shop_synclog_monitor", args=[object_id]))
        sync_log = self.get_object(request, object_id)
        if not sync_log:
            return HttpResponseRedirect(reverse("admin:shop_synclog_changelist"))
        if sync_log.status == "running":
            sync_log.stop_requested = True
            sync_log.save(update_fields=["stop_requested"])
            _append_sync_log_output(sync_log.id, "Запрошена остановка синхронизации.")
            self.message_user(request, "Запрос на остановку отправлен.", level=messages.WARNING)
        return HttpResponseRedirect(reverse("admin:shop_synclog_monitor", args=[object_id]))


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "last_name", "first_name", "birth_date", "phone", "city")
    search_fields = ("user__username", "user__email", "phone", "first_name", "last_name", "birth_date")
    list_per_page = 25
    fieldsets = (
        ("Пользователь", {"fields": ("user",)}),
        ("Контакт", {"fields": ("first_name", "last_name", "phone", "birth_date")}),
        ("Адрес", {"fields": ("city", "street", "house", "apartment", "postal_code")}),
    )


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "title", "is_gift_certificate", "price", "quantity")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "phone",
        "status",
        "payment_state",
        "yookassa_payment_id_display",
        "delivery_method",
        "payment_method",
        "total_price",
        "created_at",
    )
    list_filter = ("status", "delivery_method", "payment_method", "created_at")
    search_fields = ("full_name", "phone", "email")
    readonly_fields = (
        "payment_provider",
        "payment_id",
        "payment_status",
        "yookassa_payment_id",
        "paid_at",
        "total_price",
        "created_at",
        "updated_at",
    )
    list_editable = ("status",)
    list_per_page = 25
    date_hierarchy = "created_at"
    inlines = [OrderItemInline]
    fieldsets = (
        (
            "Статус и оплата",
            {
                "fields": (
                    "status",
                    "delivery_method",
                    "payment_method",
                    "payment_provider",
                    "payment_status",
                    "yookassa_payment_id",
                    "paid_at",
                    "total_price",
                )
            },
        ),
        ("Клиент", {"fields": ("user", "full_name", "phone", "email", "comment")}),
        ("Адрес доставки", {"fields": ("city", "street", "house", "apartment", "postal_code")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Оплата")
    def payment_state(self, obj: Order):
        if obj.payment_status == "succeeded" or obj.status == "paid" or obj.paid_at:
            return "Оплачено"
        if obj.payment_method == "card_online":
            return "Не оплачено"
        return "Не требуется"

    @admin.display(description="ID платежа (ЮKassa)")
    def yookassa_payment_id_display(self, obj: Order):
        return (obj.yookassa_payment_id or "").strip() or "—"


@admin.register(ProductRating)
class ProductRatingAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "rating", "created_at")
    list_filter = ("rating", "created_at")
    search_fields = ("product__name", "user__username", "user__email")
    list_per_page = 25
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "feedback_type", "text_short", "telegram_username", "is_processed", "created_at")
    list_filter = ("feedback_type", "is_processed", "created_at")
    search_fields = ("text", "telegram_username", "contact_phone", "contact_email")
    readonly_fields = ("telegram_user_id", "telegram_username", "created_at")
    list_editable = ("is_processed",)
    list_per_page = 25
    date_hierarchy = "created_at"
    fieldsets = (
        (None, {"fields": ("feedback_type", "text", "is_processed")}),
        ("Telegram", {"fields": ("telegram_user_id", "telegram_username")}),
        ("Контакты для связи", {"fields": ("contact_phone", "contact_email")}),
        ("Дата", {"fields": ("created_at",)}),
    )

    def text_short(self, obj):
        return (obj.text[:50] + "…") if len(obj.text) > 50 else obj.text

    text_short.short_description = "Текст"


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient_name", "issue_date", "denomination", "email")
    list_filter = ("issue_date",)
    search_fields = ("id", "recipient_name", "email")
    ordering = ("-issue_date", "-id")
    list_per_page = 50
