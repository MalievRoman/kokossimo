import re
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Q

_SEARCH_LIMIT = 15
_MIN_QUERY_LEN = 2


def search_customers(query: str) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if len(q) < _MIN_QUERY_LEN:
        return []

    User = get_user_model()
    filters = Q()

    if "@" in q:
        filters |= Q(email__icontains=q)

    digits = re.sub(r"\D", "", q)
    if len(digits) >= 4:
        filters |= Q(profile__phone__icontains=digits)

    parts = [p for p in q.split() if p]
    if parts:
        name_filter = Q()
        for part in parts:
            name_filter &= (
                Q(profile__first_name__icontains=part)
                | Q(profile__last_name__icontains=part)
                | Q(first_name__icontains=part)
                | Q(last_name__icontains=part)
            )
        filters |= name_filter

    if not filters:
        filters = (
            Q(email__icontains=q)
            | Q(profile__first_name__icontains=q)
            | Q(profile__last_name__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(profile__phone__icontains=q)
        )

    users = (
        User.objects.select_related("profile")
        .filter(filters)
        .distinct()
        .order_by("id")[:_SEARCH_LIMIT]
    )

    results = []
    for user in users:
        profile = getattr(user, "profile", None)
        first_name = ((profile.first_name if profile else user.first_name) or "").strip()
        last_name = ((profile.last_name if profile else user.last_name) or "").strip()
        email = (user.email or "").strip()
        phone = (profile.phone if profile else "") or ""
        name = f"{last_name} {first_name}".strip() or f"Пользователь #{user.pk}"
        details = []
        if email:
            details.append(email)
        if phone:
            details.append(phone)
        label = name if not details else f"{name} — {' · '.join(details)}"
        results.append(
            {
                "id": user.pk,
                "label": label,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": phone,
            }
        )
    return results
