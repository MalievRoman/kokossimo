from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("erp_analytics", "0002_moyskladoperation_and_more_entities"),
    ]

    operations = [
        migrations.AddField(
            model_name="synccheckpoint",
            name="resume_active",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="synccheckpoint",
            name="resume_filter_from",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="synccheckpoint",
            name="resume_filter_to",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="synccheckpoint",
            name="resume_next_offset",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
