from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("erp_analytics", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="synccheckpoint",
            name="entity",
            field=models.CharField(
                choices=[
                    ("customerorder", "Заказы покупателей"),
                    ("demand", "Отгрузки"),
                    ("retaildemand", "Розничные продажи"),
                    ("salesreturn", "Возвраты"),
                ],
                max_length=64,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name="MoyskladOperation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_entity", models.CharField(db_index=True, max_length=64)),
                ("external_id", models.CharField(db_index=True, max_length=64)),
                (
                    "operation_type",
                    models.CharField(
                        choices=[
                            ("order", "Заказ"),
                            ("sale", "Продажа"),
                            ("sale_retail", "Розничная продажа"),
                            ("return", "Возврат"),
                        ],
                        db_index=True,
                        max_length=24,
                    ),
                ),
                ("document_number", models.CharField(blank=True, default="", max_length=120)),
                ("moment", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("source_updated_at", models.DateTimeField(blank=True, db_index=True, null=True)),
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
                "verbose_name": "Операция МойСклад (очищенная)",
                "verbose_name_plural": "Операции МойСклад (очищенные)",
                "ordering": ["-moment", "-source_updated_at", "-id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("source_entity", "external_id"),
                        name="uniq_analytics_operation_source_entity_external_id",
                    )
                ],
            },
        ),
    ]
