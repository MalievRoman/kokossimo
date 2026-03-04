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

---

## Интеграция с МойСклад (базовый этап)

В backend добавлен API-клиент МойСклад и 2 служебные ручки для проверки интеграции.

### Настройка `.env`

```env
MOYSKLAD_API_BASE_URL=https://api.moysklad.ru/api/remap/1.2
# Вариант 1 (рекомендуется): токен
MOYSKLAD_TOKEN=ваш_токен_мойсклад
# Вариант 2: логин + пароль/токен
MOYSKLAD_LOGIN=ваш_логин_в_мойсклад
MOYSKLAD_PASSWORD=ваш_api_токен_мойсклад
MOYSKLAD_TIMEOUT_SECONDS=15
MOYSKLAD_SITE_SYNC_ENABLED=true
MOYSKLAD_SITE_CATEGORY_NAME=САЙТ КОКОССИМО
MOYSKLAD_SITE_CATEGORY_SLUG=site-kokossimo
MOYSKLAD_SYNC_INTERVAL_SECONDS=300
MOYSKLAD_SYNC_RETRY_INTERVAL_SECONDS=120
MOYSKLAD_VERIFY_SSL=true
MOYSKLAD_USE_FOLDER_TREE_FILTER=false
MOYSKLAD_IMAGE_META_FETCH=false
```

### Ручки API

- Проверка подключения: `GET /api/integrations/moysklad/status/`
- Получение ассортимента: `GET /api/integrations/moysklad/assortment/?limit=20&offset=0&search=крем`

Обе ручки доступны только авторизованному staff-пользователю (Token auth + IsAdminUser).

### Публичный каталог (frontend)

Если `MOYSKLAD_SITE_SYNC_ENABLED=true`, то:

- `GET /api/products/` и `GET /api/products/<id>/` перед ответом синхронизируют товары из МойСклад;
- в каталог попадают только товары из категории `MOYSKLAD_SITE_CATEGORY_NAME` (по умолчанию `САЙТ КОКОССИМО`);
- `GET /api/categories/` возвращает только категорию сайта (`site-kokossimo`).

### Ручная синхронизация товаров и фото

Чтобы обновить уже загруженные товары и подтянуть ссылки на изображения из МойСклад:

```powershell
python manage.py sync_moysklad_site_products
```
