# Kokossimo

Интернет‑магазин косметики с каталогом, карточками товаров, корзиной и оформлением заказов.  
Проект состоит из фронтенда на React и бэкенда на Django REST Framework, с API для товаров, категорий, авторизации и заказов.

## Возможности
- каталог товаров с фильтрацией по категориям, новинкам и бестселлерам
- карточка товара, избранное и корзина
- регистрация и вход по email или телефону, профиль пользователя
- подтверждение email по коду, сброс пароля по email
- оформление заказов, история заказов
- поддержка подарочных сертификатов
- оценки и отзывы к товарам
- загрузка данных через фикстуры и скрипты

## Технологии
- фронтенд: React, Vite, React Router, Axios
- бэкенд: Django, Django REST Framework, SQLite
- медиа: хранение изображений товаров и категорий

## Структура репозитория
- `kokossimo-frontend/` — SPA интерфейс магазина
- `kokossimo-backend/` — API и админ‑панель Django
- `.env` — общий конфиг для frontend и backend

## Связка frontend и backend через `.env`
Проект использует один корневой файл `.env`:
- Django читает `/Users/minaonsi/Desktop/kokossimo/.env` в [config/settings.py](/Users/minaonsi/Desktop/kokossimo/kokossimo-backend/config/settings.py)
- Vite читает тот же файл через `envDir: '..'` в [vite.config.js](/Users/minaonsi/Desktop/kokossimo/kokossimo-frontend/vite.config.js)
- клиентский API использует `VITE_API_URL` в [api.js](/Users/minaonsi/Desktop/kokossimo/kokossimo-frontend/src/services/api.js)

Минимальные переменные для локальной разработки:

```env
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://127.0.0.1:8000/api
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Если `.env` ещё не создан, можно взять шаблон из `.env.example`.

## Быстрый старт (локально)
### Backend
1. Из корня репозитория создайте `.env`, если его ещё нет:
   `cp .env.example .env`
2. Перейдите в `kokossimo-backend/`.
3. Создайте и активируйте виртуальное окружение:
   `python3 -m venv .venv`
   `source .venv/bin/activate`
4. Установите зависимости: `pip install -r requirements.txt`
5. Примените миграции: `python manage.py migrate`
6. Загрузите данные по желанию: `python manage.py loaddata shop/fixtures/initial_data.json`
7. Запустите сервер: `python manage.py runserver 127.0.0.1:8000`

### Frontend
1. Откройте второй терминал и перейдите в `kokossimo-frontend/`.
2. Установите зависимости: `npm install`
3. Фронтенд автоматически возьмёт `VITE_API_URL` из корневого `.env`.
4. Запустите dev‑сервер: `npm run dev`
5. Откройте `http://localhost:5173`

## Команды запуска
Backend:

```bash
cd /Users/minaonsi/Desktop/kokossimo/kokossimo-backend
source .venv/bin/activate
python manage.py runserver 127.0.0.1:8000
```

Frontend:

```bash
cd /Users/minaonsi/Desktop/kokossimo/kokossimo-frontend
npm install
npm run dev
```

## API (основные эндпоинты)
- `GET /api/products/` — товары (фильтры: `is_new`, `is_bestseller`, `category`)
- `GET /api/categories/` — категории
- `POST /api/auth/register/` — регистрация
- `POST /api/auth/login/` — вход
- `POST /api/auth/email/send/` — отправка кода на email
- `POST /api/auth/email/verify/` — подтверждение кода (login/register/reset)
- `POST /api/orders/` — создание заказа
- `GET /api/orders/list/` — список заказов пользователя
- `GET /api/products/<id>/ratings/` — список отзывов товара
- `POST /api/products/<id>/rate/` — оценка/отзыв товара (требуется токен)

## SEO файлы
Статические файлы находятся в `kokossimo-frontend/public/`:
- `robots.txt`
- `sitemap.xml`

## Продакшн заметки
- Соберите фронтенд и выложите `dist/` в веб‑директорию.
- Защитите `/admin/` (например, basic auth в nginx).
