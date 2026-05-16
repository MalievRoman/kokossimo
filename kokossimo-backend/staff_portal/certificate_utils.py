import re
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import F
from django.db.models.functions import RTrim

from shop.models import Certificate

_CERT_NUMBER_RE = re.compile(r"^[A-Za-z0-9]{16}$")
_CERTIFICATES_DB = "certificates"


def _certificates_qs():
    return Certificate.objects.using(_CERTIFICATES_DB)


def strip_certificate_input(raw: str) -> str:
    return (raw or "").strip().replace(" ", "").replace("\u00a0", "")


def is_valid_certificate_number(raw: str) -> bool:
    return bool(_CERT_NUMBER_RE.fullmatch(strip_certificate_input(raw)))


def get_certificate_by_id(cert_id: str) -> Certificate | None:
    qs = _certificates_qs()
    c = qs.filter(pk=cert_id).first()
    if c is None:
        c = qs.filter(pk__iexact=cert_id).first()
    if c is None and cert_id:
        c = (
            qs.annotate(_rid=RTrim(F("id")))
            .filter(_rid=cert_id)
            .first()
        )
        if c is None:
            c = (
                qs.annotate(_rid=RTrim(F("id")))
                .filter(_rid__iexact=cert_id)
                .first()
            )
    return c


def certificate_owner_info(certificate: Certificate | None) -> dict[str, Any] | None:
    if certificate is None or not certificate.owner_customer_id:
        return None
    owner_id = certificate.owner_customer_id
    user = (
        get_user_model()
        .objects.select_related("profile")
        .filter(pk=owner_id)
        .first()
    )
    if user is None:
        return {
            "id": owner_id,
            "first_name": "",
            "last_name": "",
            "email": "",
            "phone": "",
            "found": False,
        }
    profile = getattr(user, "profile", None)
    first_name = ((profile.first_name if profile else user.first_name) or "").strip()
    last_name = ((profile.last_name if profile else user.last_name) or "").strip()
    email = (user.email or "").strip()
    phone = ((profile.phone if profile else "") or "").strip()
    return {
        "id": owner_id,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "found": True,
    }
