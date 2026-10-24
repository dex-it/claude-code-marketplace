Задача FUL-12 выполнена в рабочем дереве, ничего не закоммичено. Сборки и тестов не было, поэтому код не проверен компилятором. Больше всего сомнений у API MassTransit в `OrderProcess.cs`: `OnUnhandledEvent(x => x.Ignore())` и `.If(Done, b => FinishCancelled(b))`.

**Изменённые файлы**
- Изменены: `src/Fulfil/Program.cs`, `src/Fulfil/Ports/Ports.cs` (добавлен `PaymentDeclinedException`), `src/Fulfil/Options/FulfilOptions.cs`, `src/Fulfil/appsettings.json`.
- Новые:
  - `src/Fulfil/Contracts/OrderProcess.cs`
  - `src/Fulfil/Processes/OrderProcess.cs` (сага)
  - `src/Fulfil/Processes/Consumers.cs`
  - `src/Fulfil/Infrastructure/MongoStore.cs`
  - `src/Fulfil/Infrastructure/OrderOutboxRelay.cs`
  - `src/Fulfil/Infrastructure/WarehouseInboundWorker.cs`

**Решения**
- **Сохранение и публикация.** `POST /orders/{id}/submit` пишет заказ с флагом `OutboxPending` одним документом. `OrderOutboxRelay` публикует `OrderSubmitted` и сбрасывает флаг, так что падение между шагами событие не теряет. Транзакции Mongo не нужны, а одиночный Mongo в compose их и не поддерживает. Дубли `OrderSubmitted` сага игнорирует.
- **Откат шагов.** Сага на MassTransit хранится в Mongo. Если платёж отклонён или шлюз упал после ретраев (`Fault<CapturePayment>`), снимается резерв. Если не удалась отгрузка, возвращаются деньги и снимается резерв. Все обработчики идемпотентны, а остатки меняются атомарно с пометкой операции в самом документе товара.
- **Нагрузка и прямой консьюмер.** У `CapturePayment` явно заданы `ConcurrentMessageLimit` (128) и `PrefetchCount` (192) на реплику, плюс экспоненциальный ретрай. Консьюмер `warehouse.inbound` на `RabbitMQ.Client` работает с `BasicQos` (prefetch 50) и ручным ack. Ack уходит только после увеличения остатка (идемпотентно по `messageId`) и подтверждённой публикации в `warehouse.outbound`. Соединение восстанавливается автоматически, а при старте подключение повторяется, пока брокер не ответит. Очередь `warehouse.inbound` принадлежит чужой системе, поэтому она только проверяется, но не объявляется.

**Ограничения**
- Реализации `IPaymentGateway` в репозитории нет, DI её не регистрирует. Её нужно добавить, иначе `CapturePaymentConsumer` не стартует.
- Я предположил, что шлюз сам дедуплицирует списание по `orderId`. Если сбой случится после списания, но до записи в `payments`, при повторе возможно двойное списание.
- Неизвестный sku и битый JSON во входящих сообщениях уходят в `nack` без возврата в очередь. Они попадут в DLX, только если его настроила чужая система, иначе будут потеряны. Routing key подтверждения пустой, формат подтверждения я выбрал сам (`messageId`, `sku`, `qty`, `status`).
