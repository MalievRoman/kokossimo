from django.db import models


class SyncCheckpoint(models.Model):
    ENTITY_CHOICES = [
        ("customerorder", "Заказы покупателей"),
        ("demand", "Отгрузки"),
        ("retaildemand", "Розничные продажи"),
        ("salesreturn", "Возвраты"),
    ]

    entity = models.CharField(max_length=64, unique=True, choices=ENTITY_CHOICES)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_run_at = models.DateTimeField(auto_now=True)
    last_status = models.CharField(max_length=20, default="idle")
    last_error = models.TextField(blank=True, default="")
    rows_processed = models.PositiveIntegerField(default=0)
    resume_filter_from = models.DateField(null=True, blank=True)
    resume_filter_to = models.DateField(null=True, blank=True)
    resume_next_offset = models.PositiveIntegerField(default=0)
    resume_active = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Checkpoint синхронизации ERP"
        verbose_name_plural = "Checkpoint'ы синхронизации ERP"

    def __str__(self):
        return f"{self.entity}: {self.last_status}"


class RawMoyskladRecord(models.Model):
    entity = models.CharField(max_length=64, db_index=True)
    external_id = models.CharField(max_length=64, db_index=True)
    source_updated_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    payload_hash = models.CharField(max_length=64, default="", blank=True)
    ingested_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Сырой документ МойСклад"
        verbose_name_plural = "Сырые документы МойСклад"
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "external_id"],
                name="uniq_analytics_raw_entity_external_id",
            )
        ]

    def __str__(self):
        return f"{self.entity}:{self.external_id}"


class MoyskladCustomerOrder(models.Model):
    external_id = models.CharField(max_length=64, unique=True, db_index=True)
    order_number = models.CharField(max_length=120, blank=True, default="")
    moment = models.DateTimeField(null=True, blank=True)
    source_updated_at = models.DateTimeField(null=True, blank=True)
    state_name = models.CharField(max_length=150, blank=True, default="")
    organization_name = models.CharField(max_length=255, blank=True, default="")
    agent_name = models.CharField(max_length=255, blank=True, default="")
    agent_email = models.EmailField(blank=True, default="")
    agent_phone = models.CharField(max_length=60, blank=True, default="")
    sum_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sum_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заказ МойСклад (очищенный)"
        verbose_name_plural = "Заказы МойСклад (очищенные)"
        ordering = ["-source_updated_at", "-id"]

    def __str__(self):
        return f"{self.order_number or self.external_id}"


class MoyskladOperation(models.Model):
    OPERATION_TYPE_CHOICES = [
        ("order", "Заказ"),
        ("sale", "Продажа"),
        ("sale_retail", "Розничная продажа"),
        ("return", "Возврат"),
    ]

    source_entity = models.CharField(max_length=64, db_index=True)
    external_id = models.CharField(max_length=64, db_index=True)
    operation_type = models.CharField(max_length=24, choices=OPERATION_TYPE_CHOICES, db_index=True)
    document_number = models.CharField(max_length=120, blank=True, default="")
    moment = models.DateTimeField(null=True, blank=True, db_index=True)
    source_updated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    state_name = models.CharField(max_length=150, blank=True, default="")
    organization_name = models.CharField(max_length=255, blank=True, default="")
    agent_name = models.CharField(max_length=255, blank=True, default="")
    agent_email = models.EmailField(blank=True, default="")
    agent_phone = models.CharField(max_length=60, blank=True, default="")
    sum_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sum_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Операция МойСклад (очищенная)"
        verbose_name_plural = "Операции МойСклад (очищенные)"
        ordering = ["-moment", "-source_updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["source_entity", "external_id"],
                name="uniq_analytics_operation_source_entity_external_id",
            )
        ]

    def __str__(self):
        return f"{self.source_entity}:{self.document_number or self.external_id}"
