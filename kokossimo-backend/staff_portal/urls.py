from django.urls import path

from .views import certificate_lookup

app_name = "staff_portal"

urlpatterns = [
    path(
        "certificates/",
        certificate_lookup,
        name="certificate_lookup",
    ),
    path("certificates", certificate_lookup),
]
