from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="MoyskladCustomerOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(db_index=True, max_length=64, unique=True)),
                ("order_number", models.CharField(blank=True, default="", max_length=120)),
                ("moment", models.DateTimeField(blank=True, null=True)),
                ("source_updated_at", models.DateTimeField(blank=True, null=True)),
                ("state_name", models.CharField(blank=True, default="", max_length=150)),
                ("organization_name", models.CharField(blank=True, default="", max_length=255)),
                ("agent_name", models.CharField(blank=True, default="", max_length=255)),
                ("agent_email", models.EmailField(blank=True, default="", max_length=254)),
                ("agent_phone", models.CharField(blank=True, default="", max_length=60)),
                ("sum_total", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("sum_paid", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("synced_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Заказ МойСклад (очищенный)",
                "verbose_name_plural": "Заказы МойСклад (очищенные)",
                "ordering": ["-source_updated_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="RawMoyskladRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entity", models.CharField(db_index=True, max_length=64)),
                ("external_id", models.CharField(db_index=True, max_length=64)),
                ("source_updated_at", models.DateTimeField(blank=True, null=True)),
                ("payload", models.JSONField(default=dict)),
                ("payload_hash", models.CharField(blank=True, default="", max_length=64)),
                ("ingested_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Сырой документ МойСклад",
                "verbose_name_plural": "Сырые документы МойСклад",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("entity", "external_id"),
                        name="uniq_analytics_raw_entity_external_id",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="SyncCheckpoint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "entity",
                    models.CharField(
                        choices=[("customerorder", "Заказы покупателей")],
                        max_length=64,
                        unique=True,
                    ),
                ),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("last_run_at", models.DateTimeField(auto_now=True)),
                ("last_status", models.CharField(default="idle", max_length=20)),
                ("last_error", models.TextField(blank=True, default="")),
                ("rows_processed", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name": "Checkpoint синхронизации ERP",
                "verbose_name_plural": "Checkpoint'ы синхронизации ERP",
            },
        ),
    ]
