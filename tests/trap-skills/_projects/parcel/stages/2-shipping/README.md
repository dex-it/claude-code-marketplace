# Parcel

Сервис доставки посылок интернет-магазина: тариф, жизненный цикл заказа, срок доставки, отправка
через перевозчика после оплаты, SMS клиенту, HTTP API заказов и карточка заказа в веб-клиенте.
Node.js 24, ES-модули, без внешних зависимостей.

## Запуск

```
npm test                  # все тесты (node:test): test/ и web/test/
npm run api               # API на http://127.0.0.1:3000 (порт - PORT), данные - data/orders-sample.json
npm run courier:sandbox   # песочница Курьер-Сервиса, см. ниже
```

Пример запроса: `curl -H 'x-customer-id: c-117' http://127.0.0.1:3000/api/orders/1001`.

Вебхук оплаты: `POST /webhooks/payments` с телом
`{ "event": "payment.succeeded", "data": { "order_id": 1003, "amount_kopecks": 12000 } }` - заказ
переходит в `paid`, у перевозчика создаётся отправка, заказ получает трек-номер и дату доставки.

## Перевозчик: Курьер-Сервис

Документация API - `docs/integrations/courier-service.md`. Настройки - переменные окружения:

| Переменная | Значение |
|---|---|
| `COURIER_URL` | адрес API, по умолчанию `http://127.0.0.1:4020` (песочница) |
| `COURIER_TOKEN` | ключ `X-Api-Key` |

Песочница для разработки: `npm run courier:sandbox` - `http://127.0.0.1:4020` (порт - `--port` или
`COURIER_SANDBOX_PORT`, `0` - любой свободный). Тестовый ключ - любой вида `cs_*`, например `cs_dev`.
Режим недоступности (ответ 503): `COURIER_SANDBOX_MODE=unavailable` при запуске или
`POST /__sandbox/mode` с телом `{"mode":"unavailable"}` (обратно - `{"mode":"normal"}`). Из тестов
песочница поднимается импортом `startCourierSandbox({ port: 0 })` из `tools/courier-sandbox.mjs`.

## Структура

```
docs/requirements/   требования: тариф, жизненный цикл заказа, дата доставки
docs/integrations/   API перевозчиков
src/tariff.js        расчёт стоимости и срока доставки
src/order.js         заказ и переходы статусов
src/eta.js           дата доставки
src/carrier/         клиенты перевозчиков
src/shipping.js      создание отправки для заказа
src/notify/          SMS клиенту
src/store.js         хранилище заказов в памяти
src/config.js        настройки из переменных окружения
src/http/            HTTP API заказов и вебхук оплаты (node:http)
tools/               песочницы внешних сервисов
web/                 веб-клиент: карточка заказа (web/src), тесты (web/test)
data/                выгрузка заказов со стенда для локального запуска
stand/deploy.json    что развёрнуто на стенде
test/                тесты сервиса
```

Суммы внутри сервиса - целые копейки, даты - `YYYY-MM-DD` или ISO 8601 с зоной.
