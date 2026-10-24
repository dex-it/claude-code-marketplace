# shipping

Сервис расчёта доставки посылок по Германии: котировка (`POST /quote`), оформление отправления
(`POST /shipments`) и печать этикетки (`label-worker`). Цены - EUR, индексы DE (5 цифр).

## Тесты

    npm test        # то же, что node --test; Node 24, зависимостей нет

## Устройство

- `src/app.js` - роутер, `handle(req, ctx)` -> `{status, body}`; HTTP-сервер и очередь даёт платформа.
- `src/request.js` - разбор тела запроса: вес, индекс, зона.
- `src/quote.js` - цена по `config/tariffs.json`.
- `src/shipments.js` - отправления, сообщение в очередь `labels`.
- `worker/label.js` - label-worker, печать этикетки.
- `docs/` - API, тарифы, контракт сообщений.
