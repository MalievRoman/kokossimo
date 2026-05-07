# Merges parallel branches after 0029 (payment_confirmation_url vs saved_delivery_address→…→certificate).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0030_order_payment_confirmation_url"),
        ("shop", "0032_certificate_unmanaged"),
    ]

    operations = []
