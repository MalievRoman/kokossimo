from django.urls import path

from .views import certificate_lookup, hub

app_name = "staff_portal"

urlpatterns = [
    path("", hub, name="hub"),
    path(
        "certificates/",
        certificate_lookup,
        name="certificate_lookup",
    ),
    path("certificates", certificate_lookup),
]
