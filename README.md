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
- `products.txt` — исходные данные для импорта

## Быстрый старт (локально)
### Backend
1. Перейдите в `kokossimo-backend/`.
2. Установите зависимости: `pip install -r requirements.txt`
3. Примените миграции: `python manage.py migrate`
4. Загрузите данные (по желанию): `python manage.py loaddata shop/fixtures/initial_data.json`
5. Запустите сервер: `python manage.py runserver`

### Frontend
1. Перейдите в `kokossimo-frontend/`.
2. Установите зависимости: `npm install`
3. Запустите dev‑сервер: `npm run dev`

## Переменные окружения (backend)
Минимальный набор в `.env`:
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG` (для прод: `false`)
- `DJANGO_ALLOWED_HOSTS` (через запятую)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS` (`true/false`)
- `DEFAULT_FROM_EMAIL`
- `EMAIL_CODE_TTL_MINUTES`

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