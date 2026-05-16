from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .certificate_issue import issue_certificate, validate_create_form
from .customer_search import search_customers

_CURRENCY_CHOICES = (
    ("RUB", "RUB — рубль"),
    ("USD", "USD — доллар"),
    ("EUR", "EUR — евро"),
)


def _form_from_cleaned(cleaned: dict) -> dict[str, str]:
    return {
        "initial_amount": cleaned.get("initial_amount", ""),
        "expires_at": cleaned.get("expires_at", ""),
        "currency": cleaned.get("currency", "RUB"),
        "owner_customer_id": cleaned.get("owner_customer_id", ""),
        "comment": cleaned.get("comment", ""),
        "customer_query": cleaned.get("customer_query", ""),
        "selected_customer_label": cleaned.get("selected_customer_label", ""),
    }


@require_http_methods(["GET"])
def customer_search(request):
    results = search_customers(request.GET.get("q", ""))
    return JsonResponse({"results": results})


@require_http_methods(["GET", "POST"])
def certificate_create(request):
    """Выпуск сертификата сотрудником."""
    form = {
        "initial_amount": "",
        "expires_at": "",
        "currency": "RUB",
        "owner_customer_id": "",
        "comment": "",
        "customer_query": "",
        "selected_customer_label": "",
    }
    errors: list[str] = []
    created_certificate = None

    if request.method == "POST":
        form = {
            "initial_amount": request.POST.get("initial_amount", ""),
            "expires_at": request.POST.get("expires_at", ""),
            "currency": request.POST.get("currency", "RUB"),
            "owner_customer_id": request.POST.get("owner_customer_id", ""),
            "comment": request.POST.get("comment", ""),
            "customer_query": request.POST.get("customer_query", ""),
            "selected_customer_label": request.POST.get("selected_customer_label", ""),
        }
        cleaned, errors = validate_create_form(form)
        form = _form_from_cleaned(cleaned)

        if not errors:
            created_by = request.user.pk if request.user.is_authenticated else None
            try:
                created_certificate = issue_certificate(
                    amount=cleaned["parsed_amount"],
                    currency=cleaned["parsed_currency"],
                    expires_at=cleaned["parsed_expires_at"],
                    owner_customer_id=cleaned["parsed_owner_id"],
                    comment=cleaned["comment"],
                    created_by=created_by,
                )
            except Exception:
                errors.append(
                    "Не удалось создать сертификат. Проверьте подключение к БД certificates."
                )
            else:
                form = {
                    "initial_amount": "",
                    "expires_at": "",
                    "currency": "RUB",
                    "owner_customer_id": "",
                    "comment": "",
                    "customer_query": "",
                    "selected_customer_label": "",
                }

    return render(
        request,
        "staff_portal/certificate_create.html",
        {
            "form": form,
            "errors": errors,
            "created_certificate": created_certificate,
            "currency_choices": _CURRENCY_CHOICES,
            "customer_search_url": reverse("staff_portal:customer_search"),
            "min_expires_date": timezone.now().date().isoformat(),
        },
    )
