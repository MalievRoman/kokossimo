from django.db.utils import ProgrammingError
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from shop.models import OrderCertificateApplication

from .certificate_redeem import (
    CertificateRedeemError,
    apply_certificate,
    cancel_certificate_application,
    finalize_certificate_application,
    parse_purchase_total,
)
from .certificate_utils import (
    certificate_owner_info,
    get_certificate_by_id,
    is_valid_certificate_number,
    strip_certificate_input,
)


def _base_form(
    *,
    certificate_number: str = "",
    purchase_total: str = "",
) -> dict[str, str]:
    return {
        "certificate_number": certificate_number,
        "purchase_total": purchase_total,
    }


def _load_pending_applications() -> list[OrderCertificateApplication]:
    try:
        return list(
            OrderCertificateApplication.objects.filter(
                status=OrderCertificateApplication.Status.PENDING,
            ).order_by("-created_at")[:10]
        )
    except ProgrammingError:
        return []


@require_http_methods(["GET", "POST"])
def certificate_apply(request):
    """Офлайн-применение сертификата: проверка, применение по сумме покупки, списание."""
    errors: list[str] = []
    form = _base_form()
    certificate = None
    certificate_owner = None
    application = None
    finalized_certificate = None
    success_message = None
    migration_required = False

    performed_by = request.user.pk if request.user.is_authenticated else None

    if request.method == "POST":
        action = (request.POST.get("action") or "check_certificate").strip()
        form = _base_form(
            certificate_number=request.POST.get("certificate_number", ""),
            purchase_total=request.POST.get("purchase_total", ""),
        )
        cert_id = strip_certificate_input(form["certificate_number"])

        if action == "cancel_application":
            app_id = request.POST.get("application_id", "").strip()
            try:
                application = OrderCertificateApplication.objects.get(
                    pk=int(app_id),
                    status=OrderCertificateApplication.Status.PENDING,
                )
            except (ValueError, OrderCertificateApplication.DoesNotExist):
                errors.append("Применение не найдено или уже обработано.")
            except ProgrammingError:
                migration_required = True
            else:
                try:
                    cancel_certificate_application(application)
                except CertificateRedeemError as exc:
                    errors.append(str(exc))
                else:
                    success_message = "Применение сертификата отменено."
                    form = _base_form()
                    application = None

        elif action == "finalize":
            app_id = request.POST.get("application_id", "").strip()
            try:
                application = OrderCertificateApplication.objects.get(
                    pk=int(app_id),
                    status=OrderCertificateApplication.Status.PENDING,
                )
            except (ValueError, OrderCertificateApplication.DoesNotExist):
                errors.append("Применение не найдено или уже обработано.")
            except ProgrammingError:
                migration_required = True
            else:
                try:
                    finalized_certificate = finalize_certificate_application(
                        application,
                        performed_by=performed_by,
                    )
                except CertificateRedeemError as exc:
                    errors.append(str(exc))
                    certificate = get_certificate_by_id(application.certificate_id)
                    certificate_owner = certificate_owner_info(certificate)
                except ProgrammingError:
                    migration_required = True
                else:
                    success_message = (
                        f"Баланс списан. Списано {application.amount} {application.currency}. "
                        f"Остаток на сертификате: {finalized_certificate.current_balance or 0} "
                        f"{finalized_certificate.currency}."
                    )
                    form = _base_form()
                    application = None

        elif action == "apply":
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
                        application = apply_certificate(
                            certificate_id=cert_id,
                            purchase_total=purchase_total,
                            performed_by=performed_by,
                        )
                    except CertificateRedeemError as exc:
                        errors.append(str(exc))
                    except ProgrammingError:
                        migration_required = True
                    else:
                        success_message = (
                            f"Сертификат применён. К списанию: {application.amount} "
                            f"{application.currency}, к оплате: {application.amount_due_after} "
                            f"{application.currency}. Нажмите «Списать»."
                        )

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
                        from .certificate_redeem import validate_certificate_for_apply

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

    pending_applications = _load_pending_applications()
    if not pending_applications and not migration_required:
        try:
            OrderCertificateApplication.objects.exists()
        except ProgrammingError:
            migration_required = True

    if migration_required:
        errors.append(
            "Таблица применений сертификатов не создана. Выполните: python manage.py migrate shop"
        )

    return render(
        request,
        "staff_portal/certificate_apply.html",
        {
            "form": form,
            "errors": errors,
            "certificate": certificate,
            "certificate_owner": certificate_owner,
            "application": application,
            "finalized_certificate": finalized_certificate,
            "success_message": success_message,
            "pending_applications": pending_applications,
        },
    )
