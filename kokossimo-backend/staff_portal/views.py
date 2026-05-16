import re
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F
from django.db.models.functions import RTrim
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from shop.models import Certificate

_CERT_NUMBER_RE = re.compile(r"^[A-Za-z0-9]{16}$")


def _strip_certificate_input(raw: str) -> str:
    return (raw or "").strip().replace(" ", "").replace("\u00a0", "")


def _get_certificate_by_id(cert_id: str):
    c = Certificate.objects.filter(pk=cert_id).first()
    if c is None:
        c = Certificate.objects.filter(pk__iexact=cert_id).first()
    if c is None and cert_id:
        c = (
            Certificate.objects.annotate(_rid=RTrim(F("id")))
            .filter(_rid=cert_id)
            .first()
        )
        if c is None:
            c = (
                Certificate.objects.annotate(_rid=RTrim(F("id")))
                .filter(_rid__iexact=cert_id)
                .first()
            )
    return c


def _certificate_owner_info(certificate: Certificate | None) -> dict[str, Any] | None:
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
            "found": False,
        }
    profile = getattr(user, "profile", None)
    first_name = ((profile.first_name if profile else user.first_name) or "").strip()
    last_name = ((profile.last_name if profile else user.last_name) or "").strip()
    return {
        "id": owner_id,
        "first_name": first_name,
        "last_name": last_name,
        "found": True,
    }


def _lookup_context(certificate: Certificate | None, **extra: Any) -> dict[str, Any]:
    return {
        "certificate_owner": _certificate_owner_info(certificate),
        **extra,
    }


@require_http_methods(["GET", "POST"])
def certificate_lookup(request):
    """Проверка сертификата по номеру. Закрывайте URL на периметре (например, auth_basic в nginx)."""
    if request.method == "POST" and request.POST.get("action") == "mark_used":
        marked_used = False
        already_used_notice = False
        expired_notice = False
        blocked_notice = False
        mark_missing = False
        certificate = None

        cid = _strip_certificate_input(request.POST.get("certificate_id", ""))
        if not _CERT_NUMBER_RE.fullmatch(cid):
            mark_missing = True
        else:
            certificate = _get_certificate_by_id(cid)
            if certificate is None:
                mark_missing = True
            elif not certificate.can_redeem_in_pos:
                if certificate.status == Certificate.Status.BLOCKED:
                    blocked_notice = True
                elif certificate.status in (Certificate.Status.REDEEMED, "used"):
                    already_used_notice = True
                elif certificate.is_expired:
                    expired_notice = True
                else:
                    already_used_notice = True
            else:
                with transaction.atomic(using="certificates"):
                    updated = Certificate.objects.filter(
                        pk=certificate.pk,
                        status__in=(
                            Certificate.Status.CREATED,
                            Certificate.Status.PARTIALLY_REDEEMED,
                        ),
                    ).update(
                        status=Certificate.Status.REDEEMED,
                        updated_at=timezone.now(),
                    )
                if updated:
                    marked_used = True
                else:
                    already_used_notice = True
                certificate = _get_certificate_by_id(certificate.pk)

        cert_num_field = ""
        if certificate is not None:
            cert_num_field = certificate.display_id
        elif _CERT_NUMBER_RE.fullmatch(cid):
            cert_num_field = cid

        return render(
            request,
            "staff_portal/certificate_lookup.html",
            _lookup_context(
                certificate,
                certificate=certificate,
                not_found=False,
                invalid_format=False,
                empty_input=False,
                certificate_number=cert_num_field[:16],
                marked_used=marked_used,
                already_used_notice=already_used_notice,
                expired_notice=expired_notice,
                blocked_notice=blocked_notice,
                mark_missing=mark_missing,
            ),
        )

    certificate = None
    not_found = False
    invalid_format = False
    empty_input = False
    raw_input = ""
    if request.method == "POST":
        raw_input = request.POST.get("certificate_number", "")
    else:
        raw_input = request.GET.get("certificate_number", "")

    stripped = _strip_certificate_input(raw_input)
    cert_id = None
    if request.method == "POST" and not stripped:
        empty_input = True
    elif stripped:
        if _CERT_NUMBER_RE.fullmatch(stripped):
            cert_id = stripped
        else:
            invalid_format = True

    if cert_id:
        certificate = _get_certificate_by_id(cert_id)
        if certificate is None:
            not_found = True

    if certificate:
        input_value = certificate.display_id
    elif not_found:
        input_value = cert_id or ""
    elif invalid_format:
        input_value = stripped[:16]
    else:
        input_value = ""

    return render(
        request,
        "staff_portal/certificate_lookup.html",
        _lookup_context(
            certificate,
            certificate=certificate,
            not_found=not_found,
            invalid_format=invalid_format,
            empty_input=empty_input,
            certificate_number=input_value,
            marked_used=False,
            already_used_notice=False,
            expired_notice=False,
            blocked_notice=False,
            mark_missing=False,
        ),
    )
