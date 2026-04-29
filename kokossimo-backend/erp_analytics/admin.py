from django.contrib import admin

from .models import (
    MoyskladCustomerOrder,
    MoyskladOperation,
    RawMoyskladRecord,
    SyncCheckpoint,
)


class OperationPresetFilter(admin.SimpleListFilter):
    title = "Бизнес-срез"
    parameter_name = "operation_preset"

    def lookups(self, request, model_admin):
        return (
            ("retail_only", "Только retaildemand"),
            ("purchases_no_orders", "Покупки без заказов (demand+retaildemand)"),
            ("net_sales", "Нетто продажи (demand+retaildemand+salesreturn)"),
        )

    def queryset(self, request, queryset):
        value = self.value()
        if value == "retail_only":
            return queryset.filter(source_entity="retaildemand")
        if value == "purchases_no_orders":
            return queryset.filter(source_entity__in=["demand", "retaildemand"])
        if value == "net_sales":
            return queryset.filter(source_entity__in=["demand", "retaildemand", "salesreturn"])
        return queryset


@admin.register(SyncCheckpoint)
class SyncCheckpointAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "last_status",
        "last_synced_at",
        "resume_active",
        "resume_next_offset",
        "rows_processed",
        "last_run_at",
    )
    list_filter = ("entity", "last_status", "resume_active", "last_run_at")
    search_fields = ("entity", "last_error")
    readonly_fields = (
        "entity",
        "last_synced_at",
        "last_run_at",
        "last_status",
        "last_error",
        "rows_processed",
        "resume_filter_from",
        "resume_filter_to",
        "resume_next_offset",
        "resume_active",
    )
    ordering = ("entity",)

    def has_add_permission(self, request):
        return False


@admin.register(RawMoyskladRecord)
class RawMoyskladRecordAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "external_id",
        "source_updated_at",
        "ingested_at",
        "payload_hash",
    )
    list_filter = ("entity", "source_updated_at", "ingested_at")
    search_fields = ("external_id", "payload_hash")
    readonly_fields = (
        "entity",
        "external_id",
        "source_updated_at",
        "payload",
        "payload_hash",
        "ingested_at",
    )
    ordering = ("-source_updated_at", "-ingested_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MoyskladCustomerOrder)
class MoyskladCustomerOrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "external_id",
        "moment",
        "state_name",
        "sum_total",
        "sum_paid",
        "source_updated_at",
    )
    list_filter = ("state_name", "moment", "source_updated_at")
    search_fields = (
        "order_number",
        "external_id",
        "agent_name",
        "agent_email",
        "agent_phone",
        "organization_name",
    )
    readonly_fields = (
        "external_id",
        "order_number",
        "moment",
        "source_updated_at",
        "state_name",
        "organization_name",
        "agent_name",
        "agent_email",
        "agent_phone",
        "sum_total",
        "sum_paid",
        "synced_at",
    )
    ordering = ("-source_updated_at", "-id")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MoyskladOperation)
class MoyskladOperationAdmin(admin.ModelAdmin):
    list_display = (
        "operation_type",
        "source_entity",
        "document_number",
        "external_id",
        "moment",
        "state_name",
        "sum_total",
        "sum_total_signed",
        "sum_paid",
    )
    list_filter = (OperationPresetFilter, "operation_type", "source_entity", "state_name", "moment")
    search_fields = (
        "document_number",
        "external_id",
        "agent_name",
        "agent_email",
        "agent_phone",
        "organization_name",
    )
    readonly_fields = (
        "operation_type",
        "source_entity",
        "external_id",
        "document_number",
        "moment",
        "source_updated_at",
        "state_name",
        "organization_name",
        "agent_name",
        "agent_email",
        "agent_phone",
        "sum_total",
        "sum_paid",
        "synced_at",
    )
    ordering = ("-moment", "-source_updated_at", "-id")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="Сумма (с учетом возврата)")
    def sum_total_signed(self, obj):
        if obj.source_entity == "salesreturn":
            return -obj.sum_total
        return obj.sum_total
