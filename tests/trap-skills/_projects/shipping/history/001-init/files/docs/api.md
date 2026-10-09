# API shipping

Суммы - EUR, если в запросе не указана `currency`. Ошибка - статус 4xx и тело `{error}`.

## POST /quote

Котировка без оформления. Тело:

- `weight` - вес: число (килограммы) или строка с единицей - `"1500g"`, `"1.5kg"`, `"1,5kg"`;
  десятичный разделитель - точка или запятая. Больше 0 и не больше 31,5 кг.
- `postcode` - индекс получателя: строка из 5 цифр, ведущий ноль допустим (`"01067"` - Дрезден).
- `express` - экспресс-доставка, `true`/`false`, по умолчанию `false`.
- `currency` - валюта цены: `EUR` (по умолчанию), `CHF`, `PLN`.

Ответ 200: `{zone, billableKg, price, currency}`; `billableKg` - расчётный вес (docs/tariffs.md).

## POST /shipments

Оформление отправления, тело - как у `/quote`. Ответ 201 - отправление:
`{id, tracking, status, postcode, zone, weightGrams, billableKg, express, price, currency, createdAt}`.
В очередь `labels` уходит сообщение для label-worker (docs/messages.md).

## GET /shipments/:id

Отправление по номеру; нет такого - 404.

## GET /health

`{status: "ok"}`.
