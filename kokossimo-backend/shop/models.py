from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

class Category(models.Model):
    name = models.CharField("Название", max_length=100)
    slug = models.SlugField("URL метка", unique=True)
    image = models.ImageField("Изображение", upload_to="categories/", blank=True, null=True)

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

    def __str__(self):
        return self.name


class ProductSubcategory(models.Model):
    """Подкатегория товара для каталога (напр. «Косметика для лица» → «очищение»)."""
    code = models.CharField("Код", max_length=20, unique=True, db_index=True)  # например 1.1, 2.3
    name = models.CharField("Название", max_length=200)
    parent_code = models.CharField("Код родителя", max_length=20, blank=True)  # 1, 2, 3, 4 — группа

    class Meta:
        verbose_name = "Подкатегория товара"
        verbose_name_plural = "Подкатегории товаров"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="products", verbose_name="Категория")
    product_subcategory = models.ForeignKey(
        ProductSubcategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="Подкатегория (тип товара)",
    )
    moysklad_id = models.CharField("ID в МойСклад", max_length=64, blank=True, null=True, unique=True, db_index=True)
    name = models.CharField("Название товара", max_length=500)
    description = models.TextField("Описание")
    composition = models.TextField("Состав", blank=True, default="")
    usage_instructions = models.TextField("Способ применения", blank=True, default="")
    price = models.DecimalField("Цена", max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField("Остаток", default=0)
    external_image_url = models.URLField("Внешняя ссылка на фото", blank=True, null=True)
    image = models.ImageField("Основное фото", upload_to="products/", blank=True, null=True)
    
    # Флаги для главной страницы
    is_bestseller = models.BooleanField("Бестселлер", default=False)
    is_new = models.BooleanField("Новинка", default=True)
    discount = models.PositiveIntegerField("Скидка %", default=0, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class SyncLog(models.Model):
    OPERATION_CHOICES = [
        ("full_sync", "Полный sync"),
        ("full_sync_no_openai", "Полный sync без OpenAI"),
        ("stock_sync", "Sync остатков"),
        ("single_product_sync", "Пересинхронизация товара"),
    ]
    STATUS_CHOICES = [
        ("running", "В процессе"),
        ("success", "Успешно"),
        ("stopped", "Остановлено"),
        ("error", "Ошибка"),
    ]

    operation = models.CharField("Операция", max_length=40, choices=OPERATION_CHOICES)
    status = models.CharField("Статус", max_length=20, choices=STATUS_CHOICES, default="running")
    source = models.CharField("Источник", max_length=30, blank=True)
    initiated_by = models.CharField("Кем запущено", max_length=150, blank=True)
    target_product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_logs",
        verbose_name="Товар",
    )
    stats = models.JSONField("Статистика", default=dict, blank=True)
    log_output = models.TextField("Вывод синхронизации", blank=True)
    stop_requested = models.BooleanField("Запрошена остановка", default=False)
    error = models.TextField("Ошибка", blank=True)
    started_at = models.DateTimeField("Начало", auto_now_add=True)
    finished_at = models.DateTimeField("Завершение", null=True, blank=True)
    duration_ms = models.PositiveIntegerField("Длительность, мс", null=True, blank=True)

    class Meta:
        verbose_name = "Лог синхронизации"
        verbose_name_plural = "Логи синхронизации"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.get_operation_display()} ({self.get_status_display()})"


class ProductRating(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="ratings", verbose_name="Товар")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="product_ratings", verbose_name="Пользователь")
    rating = models.PositiveSmallIntegerField(
        "Оценка",
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField("Отзыв", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Оценка товара"
        verbose_name_plural = "Оценки товаров"
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['product', 'user'], name='unique_product_user_rating')
        ]

    def __str__(self):
        return f"{self.product.name} - {self.rating} ({self.user_id})"


class Profile(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField("Телефон", max_length=20, blank=True)
    first_name = models.CharField("Имя", max_length=150, blank=True)
    last_name = models.CharField("Фамилия", max_length=150, blank=True)
    birth_date = models.DateField("Дата рождения", null=True, blank=True)
    city = models.CharField("Город", max_length=150, blank=True)
    street = models.CharField("Улица", max_length=200, blank=True)
    house = models.CharField("Дом", max_length=50, blank=True)
    apartment = models.CharField("Квартира", max_length=50, blank=True)
    postal_code = models.CharField("Индекс", max_length=20, blank=True)

    class Meta:
        verbose_name = "Профиль"
        verbose_name_plural = "Профили"

    def __str__(self):
        return f"{self.user.username}"


class SavedDeliveryAddress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_delivery_addresses',
        verbose_name="Пользователь",
    )
    city = models.CharField("Город", max_length=150)
    street_house = models.CharField("Улица и дом", max_length=255)
    entrance = models.CharField("Подъезд", max_length=50)
    floor = models.CharField("Этаж", max_length=50)
    apartment_office = models.CharField("Квартира / офис", max_length=100)
    intercom = models.CharField("Домофон", max_length=100)
    comment = models.TextField("Комментарий", blank=True, default="")
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлен", auto_now=True)

    class Meta:
        verbose_name = "Сохраненный адрес доставки"
        verbose_name_plural = "Сохраненные адреса доставки"
        ordering = ["-updated_at", "-created_at", "-id"]

    def __str__(self):
        return f"{self.user_id}: {self.city}, {self.street_house}"


class EmailVerificationCode(models.Model):
    PURPOSE_CHOICES = [
        ('login', 'Login'),
        ('register', 'Register'),
        ('reset', 'Reset'),
    ]

    email = models.EmailField("Email")
    code = models.CharField("Code", max_length=6)
    purpose = models.CharField("Purpose", max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Email verification code"
        verbose_name_plural = "Email verification codes"

    def __str__(self):
        return f"{self.email} ({self.purpose})"


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cart',
        verbose_name="Пользователь",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Корзина"
        verbose_name_plural = "Корзины"

    def __str__(self):
        return f"Корзина пользователя {self.user_id}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='cart_items',
        verbose_name="Товар",
    )
    external_id = models.CharField("Внешний ID", max_length=120, blank=True, default="")
    title = models.CharField("Название", max_length=255, blank=True, default="")
    is_gift_certificate = models.BooleanField("Подарочный сертификат", default=False)
    quantity = models.PositiveIntegerField("Количество", default=1)
    unit_price = models.DecimalField("Цена за единицу", max_digits=10, decimal_places=2, default=0)
    discount = models.PositiveIntegerField("Скидка %", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Позиция корзины"
        verbose_name_plural = "Позиции корзины"
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'product'],
                condition=models.Q(product__isnull=False),
                name='uniq_cartitem_cart_product',
            ),
            models.UniqueConstraint(
                fields=['cart', 'external_id'],
                condition=models.Q(is_gift_certificate=True),
                name='uniq_cartitem_cart_gift_external_id',
            ),
        ]

    def __str__(self):
        if self.product_id:
            return f"Товар {self.product_id} x {self.quantity}"
        return f"{self.title or 'Подарочный сертификат'} x {self.quantity}"


class FavoriteList(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='favorite_list',
        verbose_name="Пользователь",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Избранное"
        verbose_name_plural = "Избранное"

    def __str__(self):
        return f"Избранное пользователя {self.user_id}"


class FavoriteItem(models.Model):
    favorite_list = models.ForeignKey(FavoriteList, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='favorite_items',
        verbose_name="Товар",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Позиция избранного"
        verbose_name_plural = "Позиции избранного"
        constraints = [
            models.UniqueConstraint(fields=['favorite_list', 'product'], name='uniq_favorite_product_per_user'),
        ]

    def __str__(self):
        return f"Избранное {self.favorite_list.user_id}: товар {self.product_id}"


class Order(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('awaiting_payment', 'Ожидает оплаты'),
        ('processing', 'В обработке'),
        ('paid', 'Оплачен'),
        ('shipped', 'Отправлен'),
        ('delivered', 'Доставлен'),
        ('cancelled', 'Отменен'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash_on_delivery', 'Наличными курьеру'),
        ('cash_pickup', 'На кассе при самовывозе'),
        ('card_online', 'Карта онлайн (ЮKassa)'),
    ]

    DELIVERY_METHOD_CHOICES = [
        ('courier', 'Курьерская доставка'),
        ('pickup', 'Самовывоз'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )
    status = models.CharField("Статус", max_length=20, choices=STATUS_CHOICES, default='new')
    delivery_method = models.CharField("Способ доставки", max_length=20, choices=DELIVERY_METHOD_CHOICES, default='courier')
    payment_method = models.CharField("Способ оплаты", max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash_on_delivery')
    payment_provider = models.CharField("Провайдер оплаты", max_length=30, blank=True, default="")
    payment_id = models.CharField("ID платежа провайдера", max_length=100, blank=True, null=True, db_index=True)
    yookassa_payment_id = models.CharField(
        "Идентификатор платежа",
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Заполняется при успешной оплате через ЮKassa.",
    )
    payment_status = models.CharField("Статус платежа", max_length=30, blank=True, default="")
    paid_at = models.DateTimeField("Оплачен в", null=True, blank=True)

    full_name = models.CharField("Имя и фамилия", max_length=200)
    phone = models.CharField("Телефон", max_length=30)
    email = models.EmailField("Email", blank=True)
    city = models.CharField("Город", max_length=150)
    street = models.CharField("Улица", max_length=200)
    house = models.CharField("Дом", max_length=50)
    apartment = models.CharField("Квартира", max_length=50, blank=True)
    postal_code = models.CharField("Индекс", max_length=20, blank=True)
    comment = models.TextField("Комментарий", blank=True)

    total_price = models.DecimalField("Сумма заказа", max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        ordering = ['-created_at']

    def __str__(self):
        return f"Заказ #{self.id}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items', null=True, blank=True)
    title = models.CharField("Название", max_length=200, blank=True)
    is_gift_certificate = models.BooleanField("Подарочный сертификат", default=False)
    quantity = models.PositiveIntegerField("Количество", default=1)
    price = models.DecimalField("Цена на момент заказа", max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Позиция заказа"
        verbose_name_plural = "Позиции заказа"

    def __str__(self):
        label = self.product.name if self.product else self.title or "Позиция заказа"
        return f"{label} x {self.quantity}"

    @property
    def line_total(self):
        return self.price * self.quantity


class Feedback(models.Model):
    """Обратная связь из Telegram-бота: отзывы, предложения, просьбы о связи."""

    TYPE_CHOICES = [
        ('review', 'Отзыв'),
        ('suggestion', 'Предложение'),
        ('contact_request', 'Просьба о связи'),
    ]

    feedback_type = models.CharField(
        "Тип",
        max_length=20,
        choices=TYPE_CHOICES,
    )
    text = models.TextField("Текст сообщения")
    telegram_user_id = models.BigIntegerField("Telegram user ID", null=True, blank=True)
    telegram_username = models.CharField("Telegram @username", max_length=100, blank=True)
    contact_phone = models.CharField("Телефон для связи", max_length=30, blank=True)
    contact_email = models.EmailField("Email для связи", blank=True)
    is_processed = models.BooleanField("Обработано", default=False)
    created_at = models.DateTimeField("Дата создания", auto_now_add=True)

    class Meta:
        verbose_name = "Обратная связь"
        verbose_name_plural = "Обратная связь"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_feedback_type_display()} — {self.created_at.strftime('%d.%m.%Y %H:%M')}"
