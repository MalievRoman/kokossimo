import re

from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from shop.models import Certificate

_CERT_NUMBER_RE = re.compile(r"^[A-Za-z0-9]{16}$")


def _strip_certificate_input(raw: str) -> str:
    return (raw or "").strip().replace(" ", "").replace("\u00a0", "")


@require_http_methods(["GET", "POST"])
def staff_certificate_lookup(request):
    """Проверка сертификата по номеру. Закрывайте URL на периметре (например, auth_basic в nginx)."""
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
        certificate = Certificate.objects.filter(pk=cert_id).first()
        if certificate is None:
            certificate = Certificate.objects.filter(pk__iexact=cert_id).first()
        if certificate is None:
            not_found = True

    if certificate:
        input_value = certificate.id
    elif not_found:
        input_value = cert_id or ""
    elif invalid_format:
        input_value = stripped[:16]
    else:
        input_value = ""

    return render(
        request,
        "shop/staff_certificate_lookup.html",
        {
            "certificate": certificate,
            "not_found": not_found,
            "invalid_format": invalid_format,
            "empty_input": empty_input,
            "certificate_number": input_value,
        },
    )
