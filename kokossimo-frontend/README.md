# Kokossimo Frontend

Frontend часть интернет-магазина на React + Vite.

## Окружение

Фронтенд использует общий корневой файл `../.env`:

- `VITE_API_URL` задает базовый URL API для dev-режима
- `VITE_BACKEND_URL` используется Vite proxy для `/api`, `/media`, `/static`, `/admin`
- `FRONTEND_URL` использует backend для CORS, CSRF и redirect URL, а Vite dev server берёт из него `host` и `port`

Vite читает переменные из корня репозитория через `envDir: '..'`.

## Локальный запуск

```bash
cp ../.env.example ../.env
cd kokossimo-frontend
npm install
npm run dev
```

Приложение открывается по адресу из `FRONTEND_URL` (по умолчанию `http://localhost:5173`).

## Проверка связки с backend

Для локальной разработки backend должен быть запущен на `http://127.0.0.1:8000`, а в корневом `.env` должны быть значения:

```env
FRONTEND_URL=http://localhost:5173
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_API_URL=http://127.0.0.1:8000/api
```
