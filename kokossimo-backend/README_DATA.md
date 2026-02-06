# Инструкция по загрузке данных

## Проверка данных в базе

Выполните в терминале (в папке kokossimo-backend):

```powershell
# Активируйте виртуальное окружение
.\venv\Scripts\Activate.ps1

# Проверьте данные
python check_data.py
```

Или через Django shell:

```powershell
python manage.py shell
```

Затем в shell:
```python
from shop.models import Product, Category
print("Категорий:", Category.objects.count())
print("Товаров:", Product.objects.count())
print("Бестселлеров:", Product.objects.filter(is_bestseller=True).count())
print("Новинок:", Product.objects.filter(is_new=True).count())
```

## Загрузка данных из фикстур

Если данных нет, выполните:

```powershell
python manage.py loaddata shop/fixtures/initial_data.json
```

## Проверка API напрямую

Откройте в браузере:
- Все товары: http://127.0.0.1:8000/api/products/
- Бестселлеры: http://127.0.0.1:8000/api/products/?is_bestseller=true
- Новинки: http://127.0.0.1:8000/api/products/?is_new=true
- Категории: http://127.0.0.1:8000/api/categories/

## Если данные не загружаются

1. Убедитесь, что сервер Django запущен
2. Проверьте, что файл `shop/fixtures/initial_data.json` существует
3. Проверьте логи Django на наличие ошибок
4. Убедитесь, что миграции применены: `python manage.py migrate`

---

## Telegram-бот для обратной связи

Бот собирает отзывы, предложения и просьбы о связи от пользователей и сохраняет их в админку Django (модель **Обратная связь**).

### Настройка

1. Создайте бота в Telegram через [@BotFather](https://t.me/BotFather), получите токен.
2. В корне `kokossimo-backend` в файле `.env` добавьте:
   ```
   TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
   ```
3. Примените миграции (если ещё не применяли):
   ```powershell
   python manage.py migrate
   ```
4. Установите зависимость (если ещё не установлена):
   ```powershell
   pip install python-telegram-bot
   ```

### Запуск бота

```powershell
cd kokossimo-backend
python manage.py run_telegram_bot
```

Токен можно также передать аргументом: `python manage.py run_telegram_bot --token=ВАШ_ТОКЕН`.

### Как пользоваться

- Пользователь пишет боту `/start`, выбирает тип: **Отзыв**, **Предложение** или **Просьба о связи**.
- Вводит текст; для «Просьба о связи» бот дополнительно запросит телефон/email.
- Данные сохраняются в БД. Просмотр и отметка «Обработано» — в админке Django: раздел **Обратная связь**.
