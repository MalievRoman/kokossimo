- Backend: `kokossimo-backend/shop/serializers.py`, `kokossimo-backend/shop/views.py`, `kokossimo-backend/config/urls.py`
- Frontend: `kokossimo-frontend/src/pages/AuthPage.jsx`, `PaymentPage.jsx`, `ProfilePage.jsx`

---

## Backend (API): входные данные и правила валидации

### Каталог / товары

#### `GET /api/products/`

Query-параметры (все **опциональные**, если не указано обратное):

- **`page`**: число (пагинация DRF)
- **`page_size`**: число, максимум **60** (пагинация `ProductViewSet.CatalogPagination`)
- **`category`**: список строк (можно повторять параметр), используется как `category__slug__in`
- **`subcategory`**: список строк-кодов (например `1.1`), фильтр по `product_subcategory__code__in`
- **`parent`**: список строк-кодов (например `1`), фильтр по `product_subcategory__parent_code__in`
- **`price_min`**, **`price_max`**: строка → пытается парситься в `Decimal`
  - если значение не парсится — **молча игнорируется** (сервер не возвращает 400)
- **`q`**: строка, `.strip()`, поиск по `icontains` в `name`/`description`
- **`ordering`**: строка вида `price,-created_at` (через запятую)
  - **разрешены только**: `price`, `created_at`, `id`, `is_new`, `is_bestseller`
  - неизвестные поля **игнорируются**
- **`is_new`**, **`is_bestseller`**: фильтр включается **только если** значение ровно `'true'`

#### `GET /api/products/price-range/`

Использует те же query-параметры, что и `/api/products/` (через `get_queryset()`), возвращает минимум/максимум цены для текущей выборки.

#### `GET /api/categories/`, `GET /api/product-subcategories/`, `GET /api/product-subcategories/tree/`

Тела запроса нет; дополнительных параметров сервер не ожидает.

---

### Рейтинги товаров

#### `GET /api/products/{product_id}/ratings/`

- **path `product_id`**: int

#### `POST /api/products/{product_id}/rate/` (требует токен)

Тело (JSON), сериализатор `ProductRatingCreateSerializer`:

- **`rating`**: int, **1..5** (обязательное)
- **`comment`**: string (необязательное), **пустая строка разрешена** (`allow_blank=True`)
  - дополнительно во view применяется `.strip()`

---

### Авторизация / регистрация / email-коды

#### `POST /api/auth/register/`

Тело (JSON), сериализатор `RegisterSerializer`:

- **`method`**: choice, **`"phone"` или `"email"`** (обязательное)
- **`identifier`**: string (обязательное)
  - **формат не проверяется** (не валидируется как email/телефон), затем во view `strip()`
- **`password`**: string, **min_length = 6** (обязательное)
- **`first_name`**, **`last_name`**: string (необязательное), **blank allowed**

Дополнительно во view:

- при `method=email` запрещается регистрация, если пользователь с таким email уже существует
- при `method=phone` запрещается регистрация, если такой `username` или `profile.phone` уже есть

#### `POST /api/auth/login/`

Тело (JSON), сериализатор `LoginSerializer`:

- **`identifier`**: string (обязательное), далее `strip()`
- **`password`**: string (обязательное)

Формат `identifier` (email/телефон) **не проверяется**, сервер просто пытается найти пользователя по `username/email/profile.phone`.

#### `POST /api/auth/email/send/`

Тело (JSON), `EmailCodeSendSerializer`:

- **`email`**: валидный email (`EmailField`), далее `strip().lower()`
- **`purpose`**: choice, **`login | register | reset`**

Во view есть проверка существования/несуществования пользователя в зависимости от `purpose`.

#### `POST /api/auth/email/verify/`

Тело (JSON), `EmailCodeVerifySerializer`:

- **`email`**: email (обязательное), далее `strip().lower()`
- **`code`**: string, **ровно 6 символов** (`min_length=6`, `max_length=6`)
- **`purpose`**: `login | register | reset`
- **`password`**: в сериализаторе необязателен, но:
  - при **`reset`** сервер требует `password` (иначе 400 `{"detail": "Новый пароль обязателен."}`)
  - при **`register`** сервер требует `password` (иначе 400 `{"detail": "Пароль обязателен для регистрации."}`)
  - при наличии: `min_length=6`, пустая строка **не разрешена** (`allow_blank=False`)
- **`first_name`**, **`last_name`**: string (необязательные), blank allowed

---

### Профиль

#### `PATCH /api/auth/profile/` (требует токен)

Тело (JSON), `ProfileUpdateSerializer` (используется `partial=True`, т.е. можно прислать подмножество полей):

- **`first_name`**, **`last_name`**: string, blank allowed
- **`email`**: email, `required=False`, `allow_blank=True`
- **`phone`**, **`city`**, **`street`**, **`house`**, **`apartment`**, **`postal_code`**: string, blank allowed

Важно: в сериализаторе **не заданы `max_length`**, поэтому ограничения длины в основном остаются на уровне модели/БД.

---

### Заказы

#### `POST /api/orders/` (требует токен)

Тело (JSON), `OrderCreateSerializer`:

- **`full_name`**: string, **max_length=200** (обязательное)
- **`phone`**: string, **max_length=30** (обязательное)
- **`email`**: email (необязательное), blank allowed
- **`city`**: string, **max_length=150** (обязательное)
- **`street`**: string, **max_length=200** (обязательное)
- **`house`**: string, **max_length=50** (обязательное)
- **`apartment`**, **`postal_code`**, **`comment`**: string (необязательные), blank allowed
- **`delivery_method`**: choice из `Order.DELIVERY_METHOD_CHOICES` (обязательное)
- **`payment_method`**: choice из `Order.PAYMENT_METHOD_CHOICES` (обязательное)
- **`items`**: массив (обязательное)
  - массив **не может быть пустым** (`validate_items`)
  - для всех `product_id` проверяется существование товаров в БД (иначе ошибка `"Некоторые товары не найдены."`)

Элемент `items[]`, `OrderItemCreateSerializer`:

- **`quantity`**: int, **>= 1** (обязательное)
- **`product_id`**: int (необязательное)
- **`gift_certificate_amount`**: int (необязательное), **>= 1**
- **`gift_certificate_name`**: string (необязательное), blank allowed
- Правило: должен быть указан **либо** `product_id`, **либо** `gift_certificate_amount`
  - иначе ошибка `"Укажите товар или сумму сертификата."`

#### `GET /api/orders/list/`, `GET /api/orders/{order_id}/`

Входных полей нет (кроме path-параметра `order_id` в детальном просмотре).

---

### Интеграции МойСклад (админ + токен)

#### `GET /api/integrations/moysklad/assortment/`

- **`limit`**: int, default 20; при нечисловом значении → 400
- **`offset`**: int, default 0; при нечисловом значении → 400
- **`search`**: string, default `''`; ограничений длины нет

---

## Frontend (UI): поля ввода и клиентская валидация

### `AuthPage.jsx`

#### Вход

- **`loginEmail`** (input `type="email"`): проверка в коде — **непустое**
- **`loginPassword`**: проверка — **непустое**

Отправка: `POST /api/auth/login/` как `{ identifier, password }`.

#### Регистрация

Шаг 1:

- **`registerEmail`** (type=email): проверка — непустое
- **`registerPassword`**: непустое
- **`registerPasswordRepeat`**: непустое + **пароли совпадают**

Отправка кода: `POST /api/auth/email/send/` `{ email, purpose: "register" }`.

Шаг 2:

- **`registerCode`**: проверка — **непустое** (длина 6 символов на клиенте не проверяется)

Подтверждение: `POST /api/auth/email/verify/` `{ email, code, purpose:"register", password }`.

#### Восстановление

Шаг 1:

- **`resetEmail`**: проверка — непустое

Отправка кода: `POST /api/auth/email/send/` `{ email, purpose:"reset" }`.

Шаг 2:

- **`resetCode`**: непустое
- **`resetPassword`**, **`resetPasswordRepeat`**: непустые + совпадают

Подтверждение: `POST /api/auth/email/verify/` `{ email, code, purpose:"reset", password }`.

---

### `PaymentPage.jsx` (оформление заказа)

Поля:

- **`name`** (required)
- **`phone`** (required, type=tel) — нормализуется через `formatRuPhone`, ввод ограничивается `isPhoneInputKeyAllowed`
- **`email`** (type=email, необязательное)
- **`city`** (required)
- **`street`** (required)
- **`house`** (required)
- **`apartment`** (необязательное)
- **`postal_code`** (необязательное)
- **`comment`** (необязательное)
- **`deliveryMethod`**: `courier | pickup` (переключатель)
- **`paymentMethod`**: `cash_on_delivery | cash_pickup` (переключатель; зависит от delivery)
- **`agreement`**: checkbox (required) — проверяется **только на клиенте**

Перед созданием заказа:

- проверяется, что корзина не пустая
- проверяется наличие токена (иначе редирект на `/auth`)

Отправка заказа: `POST /api/orders/` (см. поля в Backend-разделе).

---

### `ProfilePage.jsx` (параметры профиля)

Поля:

- **ФИО**: свободный текст → на сохранении разбивается на `first_name` и `last_name`
- **Телефон**: нормализация `formatRuPhone`, ограничение ввода `isPhoneInputKeyAllowed`
- **Дата рождения**: форматируется как `DD.MM.YYYY`, **сохраняется только в `localStorage`**, на сервер не отправляется
- **Email**: type=email

Сохранение: `PATCH /api/auth/profile/` с `{ first_name, last_name, email, phone }`.

---