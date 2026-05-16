from django.db.utils import OperationalError, ProgrammingError
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from .certificate_redeem import (
    CertificateRedeemError,
    parse_purchase_total,
    redeem_certificate,
    validate_certificate_for_apply,
)
from .certificate_utils import (
    certificate_owner_info,
    get_certificate_by_id,
    is_valid_certificate_number,
    strip_certificate_input,
)

_DB_ERRORS = (ProgrammingError, OperationalError)


def _base_form(
    *,
    certificate_number: str = "",
    purchase_total: str = "",
) -> dict[str, str]:
    return {
        "certificate_number": certificate_number,
        "purchase_total": purchase_total,
    }


@require_http_methods(["GET", "POST"])
def certificate_apply(request):
    """Офлайн-применение сертификата: проверка и списание по сумме покупки."""
    errors: list[str] = []
    form = _base_form()
    certificate = None
    certificate_owner = None
    redeem_result = None
    success_message = None
    performed_by = request.user.pk if request.user.is_authenticated else None

    if request.method == "POST":
        action = (request.POST.get("action") or "check_certificate").strip()
        form = _base_form(
            certificate_number=request.POST.get("certificate_number", ""),
            purchase_total=request.POST.get("purchase_total", ""),
        )
        cert_id = strip_certificate_input(form["certificate_number"])

        if action == "redeem":
            if not is_valid_certificate_number(cert_id):
                errors.append("Номер сертификата: ровно 16 латинских букв или цифр.")
            else:
                try:
                    purchase_total = parse_purchase_total(form["purchase_total"])
                except CertificateRedeemError as exc:
                    errors.append(str(exc))
                else:
                    certificate = get_certificate_by_id(cert_id)
                    certificate_owner = certificate_owner_info(certificate)
                    try:
                        redeem_result = redeem_certificate(
                            certificate_id=cert_id,
                            purchase_total=purchase_total,
                            performed_by=performed_by,
                        )
                    except CertificateRedeemError as exc:
                        errors.append(str(exc))
                    except _DB_ERRORS:
                        errors.append("Ошибка базы данных.")
                    else:
                        success_message = (
                            f"Списано {redeem_result.redeemed_amount} {redeem_result.currency}. "
                            f"К оплате: {redeem_result.amount_due_after} {redeem_result.currency}. "
                            f"Остаток на сертификате: "
                            f"{redeem_result.certificate.current_balance or 0} "
                            f"{redeem_result.currency}."
                        )
                        form = _base_form()
                        certificate = None
                        certificate_owner = None

        else:
            if not cert_id:
                errors.append("Введите номер сертификата.")
            elif not is_valid_certificate_number(cert_id):
                errors.append("Номер должен состоять ровно из 16 символов: латинские буквы и цифры.")
            else:
                certificate = get_certificate_by_id(cert_id)
                if certificate is None:
                    errors.append("Сертификат с таким номером не найден.")
                else:
                    try:
                        validate_certificate_for_apply(certificate)
                    except CertificateRedeemError as exc:
                        errors.append(str(exc))
                    else:
                        certificate_owner = certificate_owner_info(certificate)

    elif request.GET.get("certificate_number"):
        cert_id = strip_certificate_input(request.GET.get("certificate_number", ""))
        if is_valid_certificate_number(cert_id):
            certificate = get_certificate_by_id(cert_id)
            if certificate:
                certificate_owner = certificate_owner_info(certificate)
            form["certificate_number"] = cert_id[:16]

    return render(
        request,
        "staff_portal/certificate_apply.html",
        {
            "form": form,
            "errors": errors,
            "certificate": certificate,
            "certificate_owner": certificate_owner,
            "redeem_result": redeem_result,
            "success_message": success_message,
        },
    )
