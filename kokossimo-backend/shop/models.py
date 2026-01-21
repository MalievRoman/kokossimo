from django.conf import settings
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


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="products", verbose_name="Категория")
    name = models.CharField("Название товара", max_length=200)
    description = models.TextField("Описание")
    price = models.DecimalField("Цена", max_digits=10, decimal_places=2)
    image = models.ImageField("Основное фото", upload_to="products/")
    
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


class Profile(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField("Телефон", max_length=20, blank=True)
    first_name = models.CharField("Имя", max_length=150, blank=True)
    last_name = models.CharField("Фамилия", max_length=150, blank=True)
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


class Order(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('processing', 'В обработке'),
        ('paid', 'Оплачен'),
        ('shipped', 'Отправлен'),
        ('delivered', 'Доставлен'),
        ('cancelled', 'Отменен'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash_on_delivery', 'Наличными курьеру'),
        ('cash_pickup', 'На кассе при самовывозе'),
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