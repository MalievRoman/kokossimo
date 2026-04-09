from django.apps import AppConfig


class ShopConfig(AppConfig):
    name = 'shop'

    def ready(self):
        # Подключаем сигналы (например, инвалидация токенов при смене пароля).
        from . import signals  # noqa: F401
