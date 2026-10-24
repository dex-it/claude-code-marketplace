Задача FUL-12 выполнена в рабочем дереве, без коммита. Сборки и тестов не было, так что код не проверен компилятором. Неуверенность в основном в API `MassTransit.MongoDb`: `MongoDbContext`, `AddMongoDbOutbox` и `MongoDbRepository` с фабриками написаны по памяти.

**Изменены:**
- `docker-compose.yml`
- `src/Fulfil/appsettings.json`
- `src/Fulfil/Options/FulfilOptions.cs`
- `src/Fulfil/Ports/Ports.cs`
- `src/Fulfil/Program.cs`

**Добавлены:**
- `src/Fulfil/Contracts/OrderProcess.cs`
- `src/Fulfil/Process/OrderProcessStateMachine.cs`
- `src/Fulfil/Process/Consumers.cs`
- `src/Fulfil/Process/MessagingExtensions.cs`
- `src/Fulfil/Warehouse/WarehouseInboundWorker.cs`

**Решения:**
- **Откат шагов саги (`OrderProcessStateMachine`).** Если платёж не прошёл (отказ или `Fault<CapturePayment>`), сага снимает резерв и отменяет заказ. Если не удалась отгрузка, она возвращает деньги, снимает резерв и отменяет заказ.
- **Сохранение и публикация.** `POST /orders/{id}/submit` пишет заказ и `OrderSubmitted` одной транзакцией через MassTransit Mongo outbox, так что событие не теряется при падении между записью и публикацией. Потребителям MassTransit тоже включены outbox и inbox, поэтому повторная доставка не выполняет команду дважды. Для транзакций MongoDB в `docker-compose.yml` стал replica set из одного узла, а в строку подключения добавлен `directConnection=true`.
- **Prefetch.**
  - `CapturePayment` ограничен 150 одновременными вызовами и prefetch 180 на реплику. При трёх репликах это 450 вызовов, а пик 10 тыс. в минуту при ответе шлюза до 2 с требует около 330.
  - Консьюмер `RabbitMQ.Client` читает `warehouse.inbound` с prefetch 32 и ручным подтверждением. Он ставит отметку `messageId` и увеличивает `stock` одной транзакцией. Повторно доставленное сообщение не удваивает приход. Подтверждение в `warehouse.outbound` уходит с publisher confirms, и входящее сообщение подтверждается только после него.

**Допущения, которые стоит проверить:**
- Ключ маршрутизации `stock.received` я выбрал сам. Он вынесен в `WarehouseOutboundRoutingKey`.
- Коллекция `products` с полями `Sku` и `Stock` — тоже моё допущение.
- Бизнес-отказ платёжного шлюза — это `PaymentDeclinedException`, добавленное в `Ports.cs`. Любое другое исключение шлюза повторяется пять раз, после чего сага откатывается.
- Реализации `IPaymentGateway` в сервисе нет (формат шлюза вне задачи), её нужно зарегистрировать в DI.
- Платёж не передаёт шлюзу ключ идемпотентности. Если шлюз списал деньги, но вызов упал по таймауту, повтор может списать дважды. Защищает только inbox от повторной доставки.
