# Заказ: жизненный цикл

## Статусы

`created` (создан) -> `paid` (оплачен) -> `packed` (собран) -> `shipped` (передан в доставку) -> `delivered` (доставлен).

Каждый переход выполняется только из предыдущего статуса цепочки. Пропуск шага (например, отгрузка из
`paid`), повтор шага и движение назад - ошибка `TRANSITION`, заказ не меняется.

## Отмена

| Статус | Отмена | Действия |
|---|---|---|
| `created` | разрешена | снять резерв товаров на складе |
| `paid`, `packed` | разрешена | вернуть клиенту деньги - сумму заказа `totalKopecks` - и снять резерв на складе |
| `shipped`, `delivered`, `cancelled` | запрещена | ошибка `CANCEL_FORBIDDEN`, заказ не меняется, деньги и склад не трогаются |

После отмены статус - `cancelled`.

## Интерфейс (`src/order.js`)

- `createOrder(data)` - новый заказ в статусе `created`, сумма и зона - по тарифу (`docs/requirements/tariff.md`).
- `pay(order)`, `pack(order)`, `ship(order, { trackingNumber })`, `deliver(order, { at })` - переходы.
- `cancel(order, { payments, stock })` - отмена; `payments.refund(orderId, kopecks)` возвращает деньги,
  `stock.release(items)` снимает резерв.

Функции синхронные, меняют переданный заказ и возвращают его. Ошибки - `OrderStateError` с полем `code`.
Каждый переход пишется в `order.history` (`{ status, at }`).
