from __future__ import annotations

import secrets
from typing import Optional, Tuple

from django.utils import timezone
from rest_framework import authentication
from rest_framework.authtoken.models import Token as DrfToken
from rest_framework.exceptions import AuthenticationFailed

from .models import UserAuthToken


def generate_token_key() -> str:
    # 20 bytes hex => 40 chars (matches field max_length=40)
    return secrets.token_hex(20)


class MultiTokenAuthentication(authentication.TokenAuthentication):
    """
    Token auth that supports multiple active tokens per user.

    - Primary storage: shop.UserAuthToken (many-to-one)
    - Backward-compatible fallback: rest_framework.authtoken.Token (one-to-one)
    """

    def authenticate_credentials(self, key: str):
        token = UserAuthToken.objects.select_related("user").filter(key=key).first()
        if token is not None:
            if not token.user.is_active:
                raise AuthenticationFailed("User inactive or deleted.")
            # Best-effort timestamp (no need to be perfectly consistent).
            UserAuthToken.objects.filter(id=token.id).update(last_used_at=timezone.now())
            return (token.user, token)

        legacy = DrfToken.objects.select_related("user").filter(key=key).first()
        if legacy is not None:
            if not legacy.user.is_active:
                raise AuthenticationFailed("User inactive or deleted.")
            return (legacy.user, legacy)

        raise AuthenticationFailed("Invalid token.")


def delete_token_instance(token_obj) -> bool:
    """
    Deletes only the presented token instance (current session).
    Returns True if something was deleted.
    """

    if token_obj is None:
        return False

    if isinstance(token_obj, UserAuthToken):
        deleted, _ = UserAuthToken.objects.filter(id=token_obj.id).delete()
        return deleted > 0

    if isinstance(token_obj, DrfToken):
        deleted, _ = DrfToken.objects.filter(id=token_obj.id).delete()
        return deleted > 0

    return False

