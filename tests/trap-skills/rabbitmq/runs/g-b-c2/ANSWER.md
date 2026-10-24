Задача FUL-12 выполнена в рабочем дереве, без коммита. Сборки и тестов не было, так что код не проверен компилятором.

**Изменено:**
- `src/Fulfil/Program.cs`
- `src/Fulfil/Options/FulfilOptions.cs`
- `src/Fulfil/appsettings.json`
- `src/Fulfil/Ports/Ports.cs` (добавлен `PaymentDeclinedException`)

**Добавлено:**
- `src/Fulfil/Contracts/OrderProcess.cs`
- `src/Fulfil/Storage/Storage.cs`
- `src/Fulfil/Process/OrderProcessState.cs`
- `src/Fulfil/Process/OrderProcessStateMachine.cs`
- `src/Fulfil/Process/OrderProcessDefinition.cs`
- `src/Fulfil/Consumers/CapturePaymentConsumer.cs` (вместе с его Definition)
- `src/Fulfil/Consumers/StockConsumers.cs`
- `src/Fulfil/Consumers/ShippingConsumers.cs`
- `src/Fulfil/Warehouse/WarehouseInboundWorker.cs`

**Решения:**
- **Процесс заказа.** Это MassTransit-сага в MongoDB с версионированием, потому что реплик три. Отказ шага запускает компенсации: `ReleaseStock` и `RefundPayment`.
  - **Платёж.** Отказ шлюза (`PaymentDeclinedException`) даёт `PaymentFailed`. Сбой шлюза повторяется 5 раз с нарастающей паузой, потом сага получает `Fault<CapturePayment>`. Конкурентность `CapturePayment` — 100 на реплику (`PaymentConcurrency`). Идемпотентность — через коллекцию `payments`. `IPaymentGateway` не принимает ключ идемпотентности, поэтому при падении между `ChargeAsync` и записью в `payments` возможно повторное списание.
  - **Submit.** `POST /orders/{id}/submit` сохраняет заказ и публикует `OrderSubmitted`. При повторном запросе публикует снова, а сага это игнорирует. Тело запроса — `{ customerId, lines }`. Outbox не делал: для транзакций нужен replica set, а в compose Mongo одиночный. Если процесс упадёт между записью и публикацией, повторный `POST` исправит.
- **Склад.** `WarehouseInboundWorker` читает `warehouse.inbound` через `RabbitMQ.Client` с ручным ack и переподключением. Увеличение `Stock` и дедупликация по `messageId` — одна атомарная операция в Mongo. Подтверждение уходит в `warehouse.outbound` с publisher confirms, и только потом ack. Битый JSON или неизвестный sku отбрасываются без возврата в очередь, сообщение теряется. Очередь и обменник объявляются durable, обменник — topic с ключом `stock.received`. Это моя догадка, нужно сверить с владельцем склада. В Mongo поля товара — `Sku`, `Stock`, `InboundIds`.
- **RabbitMQ.** Очереди MassTransit durable, сообщения persistent, на перезапуск узла это рассчитано.
- **Не сделано.** Реализации `IPaymentGateway` нет (формат вне задачи), её нужно зарегистрировать в DI, иначе обработчики не запустятся. Отгрузка пока только публикует `OrderShipped`, интеграции с перевозчиком нет.
