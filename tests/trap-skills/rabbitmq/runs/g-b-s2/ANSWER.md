Задача FUL-12 выполнена в рабочем дереве, ничего не закоммичено. Сборки и тестов не было, так что код не проверен компилятором. Больше всего сомнений у вызовов `MongoDbContext` (`BeginTransaction`, `CommitTransaction`, `AbortTransaction`) в `OrderEndpoints.cs`: их имена я писал по памяти.

**Новые файлы** (все в `src/Fulfil/`):
- `Contracts/FulfilmentMessages.cs`
- `Messaging/Queues.cs`
- `Messaging/MessagingSetup.cs`
- `Saga/OrderFulfilmentState.cs`
- `Saga/OrderFulfilmentStateMachine.cs`
- `Consumers/PaymentConsumers.cs`
- `Consumers/StockConsumers.cs`
- `Consumers/OrderConsumers.cs`
- `Orders/OrderEndpoints.cs`
- `Warehouse/WarehouseInboundService.cs`

**Изменены:**
- `Program.cs`
- `Ports/Ports.cs`: добавлен `PaymentDeclinedException`.
- `Options/FulfilOptions.cs`
- `appsettings.json`
- `docker-compose.yml`

**Решения:**
- **Сага и откаты:** процесс заказа — сага MassTransit (состояния Reserving → Charging → Shipping). Если платёж не прошёл, склад освобождается (`ReleaseStock`) и заказ отменяется. Если не удалась отгрузка, сначала возвращаются деньги (`RefundPayment`), потом то же самое. Сбои обработчиков (`Fault<>`) тоже запускают откат.
- **Сохранение и публикация без потери:** `submit` пишет заказ и `OrderSubmitted` одной транзакцией через MongoDB-outbox MassTransit, на консьюмерах включён inbox. Для транзакций MongoDB нужен replica set, поэтому в `docker-compose.yml` mongo запускается как replica set из одного узла, а в строку подключения добавлен `directConnection=true`.
- **Повторная доставка:**
  - Платёж: исход фиксируется в коллекции `payments`, повторное списание не выполняется.
  - Резерв и освобождение склада: идут транзакцией по записи в `stock_reservations`.
  - Приход товара: `messageId` записывается в `warehouse_inbox` в той же транзакции, что и приращение `stock`. На дубликат подтверждение в `warehouse.outbound` всё равно отправляется.
- **Prefetch и нагрузка:**
  - Платёж: `CapturePayment` — `PrefetchCount=256`, `ConcurrentMessageLimit=128` на реплику, всего ≈384 одновременных вызова на три реплики.
  - Склад: прямой консьюмер `warehouse.inbound` — prefetch 32, ручной ack, подтверждения публикации брокером. Битые сообщения отклоняются без возврата в очередь.

**Что остаётся:**
- Реализации `IPaymentGateway` в проекте нет, её надо добавить и зарегистрировать в DI.
- Шлюз должен быть идемпотентным по `orderId`. Между списанием и записью в `payments` остаётся короткое окно, которое иначе не закрыть.
- Повторный `submit` того же заказа вернёт 409.
- `ShipOrder` пока только ставит заказу статус Shipped, интеграции с перевозчиком нет.
