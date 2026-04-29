from django.contrib import admin

from .models import MoyskladCustomerOrder, RawMoyskladRecord, SyncCheckpoint


@admin.register(SyncCheckpoint)
class SyncCheckpointAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "last_status",
        "last_synced_at",
        "rows_processed",
        "last_run_at",
    )
    list_filter = ("entity", "last_status", "last_run_at")
    search_fields = ("entity", "last_error")
    readonly_fields = (
        "entity",
        "last_synced_at",
        "last_run_at",
        "last_status",
        "last_error",
        "rows_processed",
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
