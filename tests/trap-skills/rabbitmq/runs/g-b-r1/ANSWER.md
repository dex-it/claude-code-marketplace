Задача FUL-12 выполнена в рабочем дереве, без коммита. Код не собирался и не запускался: сборки нет. API MassTransit Mongo outbox и RabbitMQ.Client 7 написаны по памяти, поэтому первая сборка в CI может показать расхождения.

**Изменены**
- `docker-compose.yml`
- `src/Fulfil/Program.cs`
- `src/Fulfil/Options/FulfilOptions.cs`
- `src/Fulfil/appsettings.json`

**Добавлены**
- `src/Fulfil/Contracts/OrderProcess.cs`
- `src/Fulfil/Ports/PaymentDeclinedException.cs`
- `src/Fulfil/Processes/OrderProcess.cs`
- `src/Fulfil/Processes/OrderProcessStateMachine.cs`
- `src/Fulfil/Consumers/StockConsumers.cs`
- `src/Fulfil/Consumers/PaymentConsumers.cs`
- `src/Fulfil/Consumers/OrderConsumers.cs`
- `src/Fulfil/Consumers/ConsumerDefinitions.cs`
- `src/Fulfil/Infrastructure/Documents.cs`
- `src/Fulfil/Infrastructure/WarehouseInboundConsumer.cs`
- `src/Fulfil/Infrastructure/WarehouseConfirmationRelay.cs`

**Решения (по пунктам дисциплины)**
- **Prefetch:** у `CapturePayment` конкурентность 300 и prefetch 400, это посчитано под 10 тысяч команд в минуту при ответе шлюза до 2 с. Прямой консьюмер `warehouse.inbound` читает с prefetch 50 (настройка `WarehouseInboundPrefetch`), ack ручной и только после фиксации в Mongo.
- **Сохранение и публикация:**
  - `POST /orders/{id}/submit` пишет заказ и `OrderSubmitted` через Mongo outbox одной транзакцией.
  - Консьюмеры тоже работают через Mongo outbox.
  - Приход со склада и запись подтверждения идут в одной транзакции, а `WarehouseConfirmationRelay` отправляет подтверждение в `warehouse.outbound` с publisher confirms.
  - Транзакциям нужен replica set, поэтому Mongo в compose теперь одноузловой `rs0`, а строка подключения получила `directConnection=true`.
- **Откат шагов:**
  - Если не прошёл платёж (отказ или `Fault<CapturePayment>`), saga снимает резерв.
  - Если не удалась отгрузка, saga возвращает деньги и снимает резерв.
  - Резерв, снятие резерва и возврат идемпотентны.

**Что стоит знать**
- Реализации `IPaymentGateway` в репозитории нет, её нужно зарегистрировать в DI. Шлюз не принимает ключ идемпотентности, поэтому сбой между списанием и записью в `payments` может привести к двойному списанию.
- Консьюмеры `ShipOrder` и `OrderStatusChanged` приняты мной: отгрузочной системы в задаче нет, и `ShipOrder` просто подтверждает отгрузку. `OrderStatusChanged` обновляет статус в `orders`.
- Для `warehouse.inbound` и `warehouse.outbound` я задал параметры сам: очередь durable, обменник direct, ключ `inbound.confirmed`. Если у чужой системы они другие, объявление упадёт с `PRECONDITION_FAILED`. Тогда параметры нужно сверить.
- Состояние saga пишется в Mongo отдельно от транзакции outbox: Mongo-репозиторий saga, по моим предположениям, в неё не входит. Я это не проверял.
