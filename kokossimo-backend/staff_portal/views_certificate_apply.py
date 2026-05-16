from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from shop.models import Order, OrderCertificateApplication

from .certificate_redeem import (
    CertificateRedeemError,
    apply_certificate_to_order,
    build_redeem_preview,
    cancel_certificate_application,
    finalize_certificate_application,
)
from .certificate_utils import (
    certificate_owner_info,
    get_certificate_by_id,
    is_valid_certificate_number,
    strip_certificate_input,
)


def _parse_order_id(raw: str) -> int | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        order_id = int(value)
    except ValueError:
        return None
    return order_id if order_id > 0 else None


def _base_form(
    *,
    certificate_number: str = "",
    order_id: str = "",
) -> dict[str, str]:
    return {
        "certificate_number": certificate_number,
        "order_id": order_id,
    }


@require_http_methods(["GET", "POST"])
def certificate_apply(request):
    """Применение сертификата к заказу: проверка, расчёт, привязка, списание при финализации."""
    errors: list[str] = []
    form = _base_form()
    certificate = None
    certificate_owner = None
    order = None
    preview = None
    application = None
    finalized_certificate = None
    success_message = None

    performed_by = request.user.pk if request.user.is_authenticated else None

    if request.method == "POST":
        action = (request.POST.get("action") or "check_certificate").strip()
        form = _base_form(
            certificate_number=request.POST.get("certificate_number", ""),
            order_id=request.POST.get("order_id", ""),
        )
        cert_id = strip_certificate_input(form["certificate_number"])

        if action == "cancel_application":
            app_id = request.POST.get("application_id", "").strip()
            try:
                application = OrderCertificateApplication.objects.select_related("order").get(
                    pk=int(app_id),
                    status=OrderCertificateApplication.Status.PENDING,
                )
            except (ValueError, OrderCertificateApplication.DoesNotExist):
                errors.append("Применение не найдено или уже обработано.")
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
                application = OrderCertificateApplication.objects.select_related("order").get(
                    pk=int(app_id),
                    status=OrderCertificateApplication.Status.PENDING,
                )
            except (ValueError, OrderCertificateApplication.DoesNotExist):
                errors.append("Применение не найдено или уже обработано.")
            else:
                try:
                    finalized_certificate = finalize_certificate_application(
                        application,
                        performed_by=performed_by,
                    )
                except CertificateRedeemError as exc:
                    errors.append(str(exc))
                    certificate = get_certificate_by_id(application.certificate_id)
                    order = application.order
                    certificate_owner = certificate_owner_info(certificate)
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
                order_pk = _parse_order_id(form["order_id"])
                if order_pk is None:
                    errors.append("Укажите корректный номер заказа.")
                else:
                    try:
                        application = apply_certificate_to_order(
                            certificate_id=cert_id,
                            order_id=order_pk,
                            performed_by=performed_by,
                        )
                        application = OrderCertificateApplication.objects.select_related(
                            "order"
                        ).get(pk=application.pk)
                    except CertificateRedeemError as exc:
                        errors.append(str(exc))
                        certificate = get_certificate_by_id(cert_id)
                        order = Order.objects.filter(pk=order_pk).first()
                        certificate_owner = certificate_owner_info(certificate)
                        if certificate and order:
                            try:
                                preview = build_redeem_preview(certificate, order)
                            except CertificateRedeemError:
                                preview = None
                    else:
                        success_message = (
                            f"Сертификат применён к заказу #{application.order_id}. "
                            f"К списанию: {application.amount} {application.currency}. "
                            "Нажмите «Завершить заказ», чтобы списать баланс."
                        )
                        certificate = get_certificate_by_id(application.certificate_id)
                        order = application.order
                        certificate_owner = certificate_owner_info(certificate)

        elif action == "load_order":
            if not is_valid_certificate_number(cert_id):
                errors.append("Сначала укажите корректный номер сертификата.")
            else:
                certificate = get_certificate_by_id(cert_id)
                if certificate is None:
                    errors.append("Сертификат с таким номером не найден.")
                else:
                    certificate_owner = certificate_owner_info(certificate)
                    order_pk = _parse_order_id(form["order_id"])
                    if order_pk is None:
                        errors.append("Укажите корректный номер заказа.")
                    else:
                        order = Order.objects.filter(pk=order_pk).first()
                        if order is None:
                            errors.append("Заказ не найден.")
                        else:
                            try:
                                preview = build_redeem_preview(certificate, order)
                            except CertificateRedeemError as exc:
                                errors.append(str(exc))

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

    pending_applications = (
        OrderCertificateApplication.objects.filter(
            status=OrderCertificateApplication.Status.PENDING,
        )
        .select_related("order")
        .order_by("-created_at")[:10]
    )

    return render(
        request,
        "staff_portal/certificate_apply.html",
        {
            "form": form,
            "errors": errors,
            "certificate": certificate,
            "certificate_owner": certificate_owner,
            "order": order,
            "preview": preview,
            "application": application,
            "finalized_certificate": finalized_certificate,
            "success_message": success_message,
            "pending_applications": pending_applications,
        },
    )
