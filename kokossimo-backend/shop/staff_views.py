from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from shop.models import Certificate


def _normalize_certificate_id(raw: str) -> str:
    return (raw or "").strip().replace(" ", "").replace("\u00a0", "")


@require_http_methods(["GET", "POST"])
def staff_certificate_lookup(request):
    """Проверка сертификата по номеру. Закрывайте URL на периметре (например, auth_basic в nginx)."""
    certificate = None
    not_found = False
    raw_input = ""
    if request.method == "POST":
        raw_input = request.POST.get("certificate_number", "")
    else:
        raw_input = request.GET.get("certificate_number", "")

    cert_id = _normalize_certificate_id(raw_input)
    if cert_id:
        certificate = Certificate.objects.filter(pk=cert_id).first()
        if certificate is None:
            certificate = Certificate.objects.filter(pk__iexact=cert_id).first()
        if certificate is None:
            not_found = True

    return render(
        request,
        "shop/staff_certificate_lookup.html",
        {
            "certificate": certificate,
            "not_found": not_found,
            "certificate_number": raw_input.strip(),
            "submitted": bool(cert_id),
        },
    )
