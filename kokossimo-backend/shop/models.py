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
