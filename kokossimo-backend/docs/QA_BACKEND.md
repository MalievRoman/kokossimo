# Документация Backend API для QA-инженера

**Проект:** Kokossimo  
**Версия:** 1.0  
**Базовый URL API:** `/api/`

---

## 1. Общая информация

### 1.1 Стек и окружение

- **Framework:** Django 6.0 + Django REST Framework
- **Аутентификация:** Token Authentication (DRF)
- **Формат данных:** JSON (Content-Type: `application/json`)
- **CORS:** разрешены origin: `localhost:5173`, `127.0.0.1:5173`, `5174`

### 1.2 Запуск backend (локально)

```bash
cd kokossimo-backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API доступен по адресу: `http://127.0.0.1:8000/api/`

### 1.3 Аутентификация

Для защищённых эндпоинтов в заголовок запроса добавляется:

```
Authorization: Token <токен_пользователя>
```

Токен возвращается при успешной регистрации (`/api/auth/register/`) или входе (`/api/auth/login/`, `/api/auth/email/verify/`).

---

## 2. Карта эндпоинтов

| Метод | URL | Аутентификация | Описание |
|-------|-----|----------------|----------|
| GET | `/api/categories/` | Нет | Список категорий |
| GET | `/api/categories/<id>/` | Нет | Категория по ID |
| GET | `/api/products/` | Нет | Список товаров (с фильтрами) |
| GET | `/api/products/<id>/` | Нет | Товар по ID |
| GET | `/api/products/<id>/ratings/` | Нет | Отзывы по товару |
| POST | `/api/products/<id>/rate/` | Да | Поставить оценку/отзыв |
| POST | `/api/auth/register/` | Нет | Регистрация (email/phone) |
| POST | `/api/auth/login/` | Нет | Вход по логину и паролю |
| POST | `/api/auth/email/send/` | Нет | Отправка кода на email |
| POST | `/api/auth/email/verify/` | Нет | Проверка кода (логин/регистрация/сброс пароля) |
| POST | `/api/auth/logout/` | Да | Выход (инвалидация токена) |
| GET | `/api/auth/me/` | Да | Текущий пользователь |
| PATCH | `/api/auth/profile/` | Да | Обновление профиля |
| POST | `/api/orders/` | Да | Создание заказа |
| GET | `/api/orders/list/` | Да | Список заказов пользователя |
| GET | `/api/orders/<id>/` | Да | Детали заказа |

---

## 3. Детальное описание API

### 3.1 Категории

#### GET `/api/categories/`

**Ответ:** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Уход за лицом",
    "slug": "face",
    "image": "http://example.com/media/categories/face.jpg"
  }
]
```

- `image` — полный URL или `null`, если изображения нет.

#### GET `/api/categories/<id>/`

**Ответ:** `200 OK` — объект категории (как элемент массива выше).  
**Ошибки:** `404` — категория не найдена.

---

### 3.2 Товары

#### GET `/api/products/`

**Query-параметры (все опциональны):**

| Параметр | Значение | Описание |
|----------|----------|----------|
| `is_new` | `true` | Только новинки |
| `is_bestseller` | `true` | Только бестселлеры |
| `category` | slug категории (напр. `face`) | Товары категории |

**Примеры:**
- `/api/products/`
- `/api/products/?is_new=true`
- `/api/products/?category=face`
- `/api/products/?is_bestseller=true&category=face`

**Ответ:** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Крем",
    "description": "Описание товара",
    "price": "1500.00",
    "image": "http://example.com/media/products/cream.jpg",
    "category_slug": "face",
    "is_bestseller": true,
    "is_new": true,
    "discount": 0,
    "rating_avg": 4.5,
    "rating_count": 10,
    "user_rating": 5
  }
]
```

- `price` — строка с двумя знаками после запятой.
- `rating_avg` — средняя оценка (1–5), `rating_count` — количество отзывов.
- `user_rating` — оценка текущего пользователя или `null` (если не авторизован или не оценивал).

#### GET `/api/products/<id>/`

**Ответ:** `200 OK` — один объект товара (как в списке).  
**Ошибки:** `404` — товар не найден.

---

### 3.3 Отзывы и оценки товаров

#### GET `/api/products/<product_id>/ratings/`

**Аутентификация:** не требуется.

**Ответ:** `200 OK`

```json
[
  {
    "id": 1,
    "product": 1,
    "user_name": "Иван Иванов",
    "rating": 5,
    "comment": "Отличный крем",
    "created_at": "2025-01-15T12:00:00Z"
  }
]
```

**Ошибки:** `404` — товар не найден.

#### POST `/api/products/<product_id>/rate/`

**Аутентификация:** обязательна (Token).

**Тело запроса:**

```json
{
  "rating": 5,
  "comment": "Текст отзыва (необязательно)"
}
```

| Поле | Тип | Обязательное | Ограничения |
|------|-----|--------------|-------------|
| `rating` | integer | Да | 1–5 |
| `comment` | string | Нет | любая строка |

**Ответ при создании:** `201 Created`  
**Ответ при обновлении своей оценки:** `200 OK`

```json
{
  "rating": {
    "id": 1,
    "product": 1,
    "user_name": "Иван",
    "rating": 5,
    "comment": "Отличный крем",
    "created_at": "2025-01-15T12:00:00Z"
  },
  "rating_avg": 4.5,
  "rating_count": 11
}
```

**Ошибки:**
- `400` — невалидные данные (например, rating не 1–5).
- `401` — не авторизован.
- `404` — товар не найден.

Один пользователь может иметь только одну оценку на товар; повторный POST обновляет её.

---

### 3.4 Регистрация и вход

#### POST `/api/auth/register/`

**Тело запроса:**

```json
{
  "method": "email",
  "identifier": "user@example.com",
  "password": "securepass123",
  "first_name": "Иван",
  "last_name": "Иванов"
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `method` | string | Да | `email` или `phone` |
| `identifier` | string | Да | Email или номер телефона |
| `password` | string | Да | минимум 6 символов |
| `first_name` | string | Нет | |
| `last_name` | string | Нет | |

**Успех:** `201 Created`

```json
{
  "token": "a1b2c3d4e5f6..."
}
```

**Ошибки:** `400 Bad Request`

- При `method: "email"`: если пользователь с таким email уже есть — `{"detail": "Пользователь с таким email уже существует."}`.
- При `method: "phone"`: если пользователь с таким телефоном уже есть — `{"detail": "Пользователь с таким телефоном уже существует."}`.
- При невалидных данных — объект с полями ошибок валидации (например, `password`, `identifier`).

---

#### POST `/api/auth/login/`

**Тело запроса:**

```json
{
  "identifier": "user@example.com",
  "password": "securepass123"
}
```

`identifier` — email, username или телефон.

**Успех:** `200 OK`

```json
{
  "token": "a1b2c3d4e5f6..."
}
```

**Ошибки:** `400 Bad Request`

- Пользователь не найден: `{"detail": "Пользователь не найден."}`.
- Неверный пароль: `{"detail": "Неверный пароль."}`.

---

### 3.5 Email-коды (отправка и проверка)

#### POST `/api/auth/email/send/`

**Тело запроса:**

```json
{
  "email": "user@example.com",
  "purpose": "register"
}
```

| Поле | Значения | Описание |
|------|----------|----------|
| `purpose` | `register`, `login`, `reset` | Цель: регистрация, вход по коду, сброс пароля |

**Успех:** `200 OK` — `{"detail": "Код отправлен на почту."}`

**Ошибки:** `400 Bad Request`

- `purpose: "register"` и пользователь с таким email уже есть — `{"detail": "Пользователь с таким email уже существует."}`.
- `purpose: "login"` или `"reset"` и пользователя с таким email нет — `{"detail": "Пользователь с таким email не найден."}`.

Код действителен ограниченное время (настраивается `EMAIL_CODE_TTL_MINUTES`, по умолчанию 10 минут).

---

#### POST `/api/auth/email/verify/`

**Тело запроса (пример для регистрации после кода):**

```json
{
  "email": "user@example.com",
  "code": "123456",
  "purpose": "register",
  "password": "newpass123",
  "first_name": "Иван",
  "last_name": "Иванов"
}
```

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `email` | Да | Email |
| `code` | Да | 6 символов |
| `purpose` | Да | `register`, `login`, `reset` |
| `password` | Для `register` и `reset` | Минимум 6 символов |
| `first_name`, `last_name` | Нет | Для `register` |

Поведение по `purpose`:

- **login** — проверка кода, в ответе только `token`. Пароль не нужен.
- **reset** — проверка кода + обязательное поле `password`; пароль меняется, в ответе `token` и `detail`.
- **register** — проверка кода + обязательное поле `password`; создаётся пользователь, в ответе `token`.

**Успех:** `200 OK` (login/reset) или `201 Created` (register)

```json
{
  "token": "a1b2c3d4e5f6..."
}
```

Для reset может быть: `{"token": "...", "detail": "Пароль обновлен."}`.

**Ошибки:** `400 Bad Request`

- Неверный или просроченный код: `{"detail": "Неверный или просроченный код."}`.
- Для register без пароля: `{"detail": "Пароль обязателен для регистрации."}`.
- Для reset без пароля: `{"detail": "Новый пароль обязателен."}`.
- Пользователь не найден (login/reset): `{"detail": "Пользователь не найден."}`.
- При register, если email уже занят: `{"detail": "Пользователь с таким email уже существует."}`.

---

### 3.6 Выход и текущий пользователь

#### POST `/api/auth/logout/`

**Аутентификация:** обязательна. Токен после запроса удаляется.

**Успех:** `200 OK` — `{"detail": "Вы вышли из аккаунта."}`  
**Ошибки:** `401` — не авторизован.

---

#### GET `/api/auth/me/`

**Аутентификация:** обязательна.

**Успех:** `200 OK`

```json
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "email": "user@example.com",
  "phone": "",
  "city": "",
  "street": "",
  "house": "",
  "apartment": "",
  "postal_code": ""
}
```

**Ошибки:** `401` — не авторизован.

---

### 3.7 Профиль

#### PATCH `/api/auth/profile/`

**Аутентификация:** обязательна.

**Тело запроса (все поля необязательны, можно передать часть):**

```json
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "email": "user@example.com",
  "phone": "+79001234567",
  "city": "Москва",
  "street": "ул. Примерная",
  "house": "1",
  "apartment": "10",
  "postal_code": "123456"
}
```

**Успех:** `200 OK` — в ответе объект с актуальными полями профиля (как в примере для `/api/auth/me/`).

**Ошибки:** `400` — ошибки валидации (например, неверный email). `401` — не авторизован.

---

### 3.8 Заказы

#### POST `/api/orders/`

**Аутентификация:** обязательна.

**Тело запроса:**

```json
{
  "full_name": "Иван Иванов",
  "phone": "+79001234567",
  "email": "user@example.com",
  "city": "Москва",
  "street": "ул. Примерная",
  "house": "1",
  "apartment": "10",
  "postal_code": "123456",
  "comment": "Позвонить за час",
  "delivery_method": "courier",
  "payment_method": "cash_on_delivery",
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    },
    {
      "gift_certificate_amount": 3000,
      "gift_certificate_name": "Сертификат на 3000 ₽",
      "quantity": 1
    }
  ]
}
```

**Обязательные поля:**

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `full_name` | string | max 200 |
| `phone` | string | max 30 |
| `city` | string | max 150 |
| `street` | string | max 200 |
| `house` | string | max 50 |
| `delivery_method` | string | `courier`, `pickup` |
| `payment_method` | string | `cash_on_delivery`, `cash_pickup` |
| `items` | array | минимум 1 элемент |

**Необязательные:** `email`, `apartment`, `postal_code`, `comment`.

**Элемент `items`:**

- Либо товар: `product_id` (id существующего товара) + `quantity` (integer ≥ 1).
- Либо сертификат: `gift_certificate_amount` (integer ≥ 1) + опционально `gift_certificate_name` + `quantity`.

В одном заказе можно комбинировать товары и сертификаты. Хотя бы одна позиция должна быть (товар или сертификат).

**Успех:** `201 Created` — возвращается полный объект заказа (как в разделе GET заказа ниже).

**Ошибки:** `400` — невалидные данные или пустой `items`, несуществующий `product_id`. `401` — не авторизован.

---

#### GET `/api/orders/list/`

**Аутентификация:** обязательна.

**Успех:** `200 OK` — массив заказов текущего пользователя (полные объекты с `items`), отсортированы по дате создания (новые первые).

Формат каждого заказа — как в ответе GET `/api/orders/<id>/` (см. ниже).

---

#### GET `/api/orders/<order_id>/`

**Аутентификация:** обязательна. Возвращается только заказ текущего пользователя.

**Успех:** `200 OK`

```json
{
  "id": 1,
  "status": "new",
  "delivery_method": "courier",
  "payment_method": "cash_on_delivery",
  "full_name": "Иван Иванов",
  "phone": "+79001234567",
  "email": "user@example.com",
  "city": "Москва",
  "street": "ул. Примерная",
  "house": "1",
  "apartment": "10",
  "postal_code": "123456",
  "comment": "Позвонить за час",
  "total_price": "4500.00",
  "created_at": "2025-01-15T12:00:00Z",
  "items": [
    {
      "product_id": 1,
      "product_name": "Крем",
      "product_image": "http://example.com/media/products/cream.jpg",
      "is_gift_certificate": false,
      "quantity": 2,
      "price": "1500.00",
      "line_total": 3000.00
    },
    {
      "product_id": null,
      "product_name": "Сертификат на 3000 ₽",
      "product_image": null,
      "is_gift_certificate": true,
      "quantity": 1,
      "price": "3000.00",
      "line_total": 3000.00
    }
  ]
}
```

**Статусы заказа:** `new`, `processing`, `paid`, `shipped`, `delivered`, `cancelled`.

**Ошибки:** `404` — заказ не найден или принадлежит другому пользователю. `401` — не авторизован.

---

## 4. Справочник данных (модели)

### Категория (Category)

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK |
| name | string | Название |
| slug | string | Уникальный slug для URL |
| image | ImageField | Необязательно |

### Товар (Product)

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK |
| category_id | int | FK на Category |
| name | string | Название |
| description | text | Описание |
| price | decimal | Цена |
| image | ImageField | Основное фото |
| is_bestseller | bool | Бестселлер |
| is_new | bool | Новинка |
| discount | int | Скидка % (0 и выше) |

### Заказ (Order)

| Поле | Тип | Допустимые значения |
|------|-----|---------------------|
| status | string | `new`, `processing`, `paid`, `shipped`, `delivered`, `cancelled` |
| delivery_method | string | `courier`, `pickup` |
| payment_method | string | `cash_on_delivery`, `cash_pickup` |

### Код подтверждения email (EmailVerificationCode)

| Поле | Описание |
|------|----------|
| purpose | `login`, `register`, `reset` |
| code | 6 символов |
| TTL | Настраивается (по умолчанию 10 минут) |

---

## 5. Коды ответов и типичные ошибки

| Код | Описание |
|-----|----------|
| 200 | OK |
| 201 | Created (регистрация, создание заказа, новая оценка) |
| 400 | Bad Request — ошибки валидации или бизнес-логики (тело с полями ошибок или `detail`) |
| 401 | Unauthorized — нет или неверный токен |
| 404 | Not Found — ресурс не найден |

При 400 тело ответа — JSON: либо `{"detail": "сообщение"}`, либо `{"field_name": ["сообщение"]}`.

---

## 6. Чек-лист для тестирования

### Категории и товары

- [ ] GET категорий — 200, корректная структура и URL изображений.
- [ ] GET категории по id — 200; для несуществующего id — 404.
- [ ] GET товаров без фильтров — 200, список товаров.
- [ ] GET товаров с `is_new=true`, `is_bestseller=true`, `category=<slug>` — 200, отфильтрованный список.
- [ ] GET товара по id — 200; несуществующий id — 404.
- [ ] GET отзывов товара — 200; несуществующий товар — 404.

### Оценки товаров

- [ ] POST оценки без токена — 401.
- [ ] POST с токеном, валидные rating (1–5) и comment — 201 или 200, обновление rating_avg/rating_count.
- [ ] POST с rating вне 1–5 — 400.
- [ ] Повторный POST от того же пользователя — обновление существующей оценки, 200.

### Регистрация и вход

- [ ] Регистрация по email с уникальным email — 201, токен в ответе.
- [ ] Регистрация по email с занятым email — 400, сообщение о существующем пользователе.
- [ ] Регистрация по phone с уникальным телефоном — 201, токен.
- [ ] Регистрация с коротким паролем (< 6) — 400.
- [ ] Вход с верными identifier и паролем — 200, токен.
- [ ] Вход с несуществующим identifier — 400.
- [ ] Вход с неверным паролем — 400.

### Email-коды

- [ ] Отправка кода для register на новый email — 200.
- [ ] Отправка кода для register на занятый email — 400.
- [ ] Отправка кода для login/reset на несуществующий email — 400.
- [ ] Verify с верным кодом и purpose=login — 200, токен.
- [ ] Verify с неверным/просроченным кодом — 400.
- [ ] Verify с purpose=register + password — 201, создание пользователя, токен.
- [ ] Verify с purpose=reset без password — 400; с password — 200, пароль обновлён, токен в ответе.

### Профиль и авторизация

- [ ] GET /api/auth/me/ без токена — 401; с валидным токеном — 200, данные пользователя.
- [ ] PATCH профиля с токеном — 200, обновлённые поля в ответе.
- [ ] POST logout с токеном — 200; повторный запрос с тем же токеном — 401.

### Заказы

- [ ] POST заказа без токена — 401.
- [ ] POST заказа с валидными данными и items (товары и/или сертификаты) — 201, полный объект заказа, total_price и items соответствуют данным.
- [ ] POST с пустым items — 400.
- [ ] POST с несуществующим product_id — 400.
- [ ] GET list заказов с токеном — 200, только заказы текущего пользователя.
- [ ] GET заказа по id своего заказа — 200; по id чужого — 404; без токена — 401.

### Общее

- [ ] Запросы с неверным/истёкшим токеном на защищённые эндпоинты — 401.
- [ ] Content-Type: application/json для POST/PATCH где ожидается тело.
- [ ] Корректная обработка пустых/пробельных строк где они допустимы (например, comment, необязательные поля).

---

## 7. Переменные окружения (для тестового стенда)

| Переменная | Описание | По умолчанию / пример |
|------------|----------|------------------------|
| DJANGO_DEBUG | Включить режим отладки | false |
| DJANGO_ALLOWED_HOSTS | Разрешённые хосты | через запятую |
| POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT | PostgreSQL | если не заданы — используется SQLite |
| EMAIL_BACKEND | Бэкенд почты | smtp |
| EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD | SMTP | для отправки кодов |
| EMAIL_CODE_TTL_MINUTES | Время жизни кода (минуты) | 10 |
| DEFAULT_FROM_EMAIL | Отправитель писем с кодом | EMAIL_HOST_USER |

Для тестов отправки писем можно использовать `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` — письма выводятся в консоль.
