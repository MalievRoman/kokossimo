from django.contrib.auth import get_user_model
from django.db.models.signals import pre_save
from django.dispatch import receiver

from knox.models import AuthToken

User = get_user_model()


@receiver(pre_save, sender=User)
def invalidate_tokens_on_password_change(sender, instance, update_fields=None, **kwargs):
    """
    Если у пользователя изменился хэш пароля — инвалидируем все активные токены.

    Подписка только на User (не на каждый pre_save в проекте).
    Если save(..., update_fields=...) и пароль не в списке — лишний SELECT к БД не делаем.
    """
    if not instance.pk:
        return

    if update_fields is not None and "password" not in update_fields:
        return

    if update_fields is not None and "password" in update_fields:
        AuthToken.objects.filter(user=instance).delete()
        return

    old_password = (
        User.objects.filter(pk=instance.pk)
        .values_list("password", flat=True)
        .first()
    )
    if old_password and old_password != instance.password:
        AuthToken.objects.filter(user=instance).delete()
