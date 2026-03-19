# QA чек-лист: ЮKassa (редирект + webhook)

## Подготовка
- Заполнены переменные: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL`.
- В кабинете ЮKassa webhook указывает на `POST /api/payments/yookassa/webhook/`.
- На фронте доступна опция оплаты `Онлайн-оплата картой (ЮKassa)`.

## Ручной сценарий: успешная оплата
- [ ] Создать заказ в checkout с методом оплаты `yookassa`.
- [ ] После создания заказа происходит редирект на страницу ЮKassa.
- [ ] После успешной оплаты пользователь возвращается на `/checkout/success?order=<id>`.
- [ ] В заказе `payment_status = succeeded`, `status = paid`, заполнены `payment_id`, `payment_provider`, `paid_at`.

## Ручной сценарий: отмена оплаты
- [ ] Создать заказ с `yookassa`, перейти на ЮKassa.
- [ ] Отменить платеж на стороне ЮKassa.
- [ ] Webhook обрабатывается без ошибок.
- [ ] В заказе `payment_status = canceled`, `status = cancelled` (если ранее не был `paid`).

## Негативные и защитные проверки
- [ ] Повторный webhook для того же платежа не ломает статус (идемпотентность).
- [ ] При несовпадении суммы платежа и `order.total_price` webhook отклоняется.
- [ ] Для уже оплаченного заказа нельзя создать новый платеж через `/api/payments/yookassa/create/`.
- [ ] Для заказа с методом оплаты не `yookassa` endpoint создания платежа возвращает ошибку.
