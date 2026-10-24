Задача FUL-12 выполнена в рабочем дереве, ничего не закоммичено. Сборки и тестов не было, поэтому код не проверен компилятором.

**Изменённые файлы**
- Изменены: `docker-compose.yml`, `src/Fulfil/Program.cs`, `src/Fulfil/Options/FulfilOptions.cs`, `src/Fulfil/appsettings.json`, `src/Fulfil/Ports/Ports.cs` (добавлен `PaymentDeclinedException`).
- Новые: `Contracts/FulfilmentMessages.cs`, `Sagas/OrderFulfilmentStateMachine.cs`, `Consumers/CapturePaymentConsumer.cs`, `Consumers/StockConsumers.cs`, `Consumers/ShipOrderConsumer.cs`, `Endpoints/OrderEndpoints.cs`, `Persistence/Collections.cs`, `Warehouse/WarehouseInboundWorker.cs`.

**Решения**
- **Процесс и платежи.**
  - Процесс — сага MassTransit в MongoDB, шаги `ReserveStock` → `CapturePayment` → `ShipOrder`.
  - Отказ платежа или нехватка товара — деловые исходы: сага снимает резерв и отменяет заказ.
  - Сбой шлюза после 8 повторов с нарастающей паузой уходит в `_error` для ручного разбора, потому что исход списания неизвестен.
  - Все обработчики идемпотентны при повторной доставке.
  - `CapturePayment` рассчитан на 10 тысяч команд в минуту: 128 параллельных вызовов на реплику, три реплики, плюс таймаут шлюза 15 с и circuit breaker.
- **Склад и сообщения.**
  - Воркер читает `warehouse.inbound` через `RabbitMQ.Client` с ручным ack и переподключением, если брокер недоступен на старте.
  - Подтверждение уходит в `warehouse.outbound` с publisher confirms, ack — только после него.
  - Запись `messageId` и увеличение `stock` идут одной транзакцией MongoDB, поэтому повторная доставка не удвоит приход.
  - `POST /orders/{id}/submit` сохраняет заказ и публикует `OrderSubmitted` без outbox. Если публикация упала, повторный запрос публикует событие заново, а сага игнорирует дубли.
- **Платформа.** Транзакциям MongoDB нужен replica set, поэтому в compose Mongo запускается как replica set из одного узла, а строка подключения получила `?replicaSet=rs0`. Для RabbitMQ добавлены фиксированный `hostname` и том, чтобы очереди переживали пересоздание контейнера.

**Что проверить**
- Нет реализаций `IPaymentGateway` и `IPriceSource`, поэтому приложение не поднимется, пока их не зарегистрируют (формат шлюза вне задачи).
- Шлюз должен считать `orderId` ключом идемпотентности. Иначе падение процесса между списанием и записью статуса приведёт к двойному списанию.
- Очередь `warehouse.inbound` и обменник `warehouse.outbound` объявляются пассивно, как чужие. Пока склад их не создал, воркер повторяет попытки.
- Формат подтверждения я придумал сам: `{messageId, sku, qty, status}`. Его нужно согласовать со складом.
- Продукты читаются как `BsonDocument` с полями `Sku` и `Stock`, коллекция `products`. Имя коллекции — моё допущение.
