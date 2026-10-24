Задача FUL-12 выполнена в рабочем дереве, без коммита. Сборки и тестов не было, поэтому код не проверен компилятором. Особенно не уверен в названиях методов `MongoDbContext` (`BeginTransaction`, `Commit`, `Rollback`) и в настройке outbox в MassTransit 8.5.

**Новые файлы**
- `src/Fulfil/Contracts/OrderFlow.cs`
- `src/Fulfil/Flow/OrderFlowStateMachine.cs`
- `src/Fulfil/Flow/CapturePaymentConsumer.cs`
- `src/Fulfil/Flow/StockConsumers.cs`
- `src/Fulfil/Flow/MessagingExtensions.cs`
- `src/Fulfil/Warehouse/WarehouseInboundWorker.cs`

**Изменённые файлы**
- `src/Fulfil/Program.cs`
- `src/Fulfil/Options/FulfilOptions.cs`
- `src/Fulfil/Ports/Ports.cs`
- `src/Fulfil/appsettings.json`
- `docker-compose.yml`

**Принятые решения**
- **Сохранение и публикация.** `POST /orders/{id}/submit` пишет заказ и `OrderSubmitted` одной транзакцией через MassTransit bus outbox в MongoDB. Для этого MongoDB в compose переведена в replica set из одного узла, и строка подключения получила `?replicaSet=rs0`. Тот же outbox и inbox стоят на всех эндпоинтах. Приход со склада читается напрямую через `RabbitMQ.Client` с `prefetch=50`, ack идёт только после подтверждения публикации в `warehouse.outbound`, а `messageId` защищает остаток от повторного приращения.
- **Сага и откат.** Резерв → списание → отгрузка. Отказ платежа или `Fault<CapturePayment>` снимает резерв (`ReleaseStock`). Сбой отгрузки возвращает деньги (`RefundPayment`) и снимает резерв. Платёж защищён записью `payments/{orderId}`, резерв — записью `reservations/{orderId}`. `CapturePayment` обрабатывается с `ConcurrentMessageLimit=200` и `prefetch=250` на реплику: при 3 репликах и ответе шлюза до 2 с это покрывает около 330 запросов в полёте.
- **Неочевидное.**
  - Отказ платежа шлюз должен сигналить новым `PaymentDeclinedException`. Остальные исключения повторяются с нарастающей паузой.
  - Если процесс оборвался после вызова шлюза, но до записи `Charged`, повторная доставка вызовет `ChargeAsync` снова. Это возможно, потому что `IPaymentGateway` не принимает ключ идемпотентности, так что шлюз должен сам дедуплицировать по `orderId`.
  - Реализации `IPaymentGateway` в проекте нет (формат шлюза вне задачи), поэтому её нужно зарегистрировать в DI.
  - Я предположил, что `products` в MongoDB хранится с `_id = sku`, а очередь и обменник склада уже созданы чужой системой. Некорректные приходы и приходы по неизвестному SKU отклоняются без возврата в очередь.
