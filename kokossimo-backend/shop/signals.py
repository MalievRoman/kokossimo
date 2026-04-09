from django.contrib.auth import get_user_model
from django.db.models.signals import pre_save
from django.dispatch import receiver

from knox.models import AuthToken


@receiver(pre_save)
def invalidate_tokens_on_password_change(sender, instance, **kwargs):
    """
    Если у пользователя изменился хэш пароля — инвалидируем все активные токены.

    Это покрывает смену пароля через админку/ORM и любые другие места,
    а не только наш endpoint reset.
    """
    User = get_user_model()
    if sender is not User:
        return

    if not instance.pk:
        return

    old_password = (
        User.objects.filter(pk=instance.pk)
        .values_list("password", flat=True)
        .first()
    )
    if not old_password:
        return

    if old_password != instance.password:
        AuthToken.objects.filter(user=instance).delete()

