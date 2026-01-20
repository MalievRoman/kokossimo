from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0009_orderitem_certificate_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailVerificationCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, verbose_name="Email")),
                ("code", models.CharField(max_length=6, verbose_name="Code")),
                ("purpose", models.CharField(choices=[("login", "Login"), ("register", "Register")], max_length=20, verbose_name="Purpose")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("is_used", models.BooleanField(default=False)),
            ],
            options={
                "verbose_name": "Email verification code",
                "verbose_name_plural": "Email verification codes",
            },
        ),
    ]
