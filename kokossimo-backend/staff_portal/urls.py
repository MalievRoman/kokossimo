from django.urls import path

from .views import certificate_lookup, hub
from .views_certificate_apply import certificate_apply
from .views_certificate_create import certificate_create, customer_search

app_name = "staff_portal"

urlpatterns = [
    path("", hub, name="hub"),
    path(
        "certificates/",
        certificate_lookup,
        name="certificate_lookup",
    ),
    path("certificates", certificate_lookup),
    path(
        "certificates/create/",
        certificate_create,
        name="certificate_create",
    ),
    path("certificates/create", certificate_create),
    path(
        "certificates/apply/",
        certificate_apply,
        name="certificate_apply",
    ),
    path("certificates/apply", certificate_apply),
    path(
        "api/customers/search/",
        customer_search,
        name="customer_search",
    ),
]
