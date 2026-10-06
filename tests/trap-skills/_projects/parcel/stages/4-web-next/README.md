# Parcel

Сервис доставки посылок интернет-магазина: тариф, жизненный цикл заказа, срок доставки, отправка
через перевозчика после оплаты, SMS клиенту, HTTP API заказов и карточка заказа в веб-клиенте.
Node.js 24, ES-модули, без внешних зависимостей.

## Запуск

```
npm test                  # все тесты (node:test): test/ и web/test/
npm run api               # API на http://127.0.0.1:3000 (порт - PORT), данные - data/
npm run courier:sandbox   # песочница Курьер-Сервиса
npm run carrier:sandbox   # песочница SwiftPost
```

Пример запроса: `curl -H 'x-customer-id: c-301' http://127.0.0.1:3000/api/orders/1042`, отмена -
`curl -X POST -H 'x-customer-id: c-117' http://127.0.0.1:3000/api/orders/1040/cancel`.

Вебхук оплаты: `POST /webhooks/payments` с телом
`{ "event": "payment.succeeded", "data": { "order_id": 1041, "amount_kopecks": 126000 } }` - заказ
переходит в `paid`, у перевозчика создаётся отправка, заказ получает трек-номер и дату доставки
(`src/http/webhooks.js`).

## Перевозчики и песочницы

Песочницы - локальные HTTP-серверы, повторяют поведение API перевозчика. Порт `0` - любой свободный,
адрес печатается при запуске. Из тестов песочницы поднимаются импортом: `startCourierSandbox({ port: 0 })`
из `tools/courier-sandbox.mjs`, `startSwiftPostSandbox({ port: 0 })` из `tools/swiftpost-sandbox.mjs`;
оба возвращают `{ url, port, setMode(mode), close() }`.

### Курьер-Сервис

Документация API - `docs/integrations/courier-service.md`. Настройки - переменные окружения:
`COURIER_URL` (по умолчанию `http://127.0.0.1:4020`) и `COURIER_TOKEN` (ключ `X-Api-Key`).

Песочница: `npm run courier:sandbox` - `http://127.0.0.1:4020` (порт - `--port` или
`COURIER_SANDBOX_PORT`). Тестовый ключ - любой вида `cs_*`, например `cs_dev`. Режим недоступности
(ответ 503): `COURIER_SANDBOX_MODE=unavailable` при запуске или `POST /__sandbox/mode` с телом
`{"mode":"unavailable"}` (обратно - `{"mode":"normal"}`).

### SwiftPost

Новый перевозчик (подключение - PAR-17). Документация API - `docs/integrations/swiftpost-api.md`.

Песочница: `npm run carrier:sandbox` - `http://127.0.0.1:4010` (порт - `--port` или
`SWIFTPOST_SANDBOX_PORT`). Тестовый токен - `sbx_parcel_dev` (принимается любой вида `sbx_*`),
заголовок `Authorization: Bearer <токен>`. Режим недоступности (ответ 503): `SWIFTPOST_SANDBOX_MODE=unavailable`
при запуске или `POST /__sandbox/mode` с телом `{"mode":"unavailable"}` (обратно - `{"mode":"normal"}`).

## Структура

```
docs/requirements/   требования: тариф, жизненный цикл заказа, дата доставки
docs/integrations/   API перевозчиков
src/tariff.js        расчёт стоимости и срока доставки
src/order.js         заказ: переходы статусов, отмена, возврат
src/eta.js           дата доставки
src/carrier/         клиенты перевозчиков
src/shipping.js      создание отправки для заказа
src/notify/          SMS клиенту
src/store.js         хранилище заказов в памяти
src/archive.js       архив заказов старше года
src/config.js        настройки из переменных окружения
src/http/            HTTP API заказов и вебхук оплаты (node:http)
tools/               песочницы перевозчиков
web/                 веб-клиент: карточка заказа (web/src), тесты (web/test)
data/                выгрузка заказов со стенда для локального запуска
stand/deploy.json    что развёрнуто на стенде
test/                тесты сервиса
```

Суммы внутри сервиса - целые копейки, даты - `YYYY-MM-DD` или ISO 8601 с зоной.
