Задача FUL-12 выполнена в рабочем дереве, ничего не закоммичено. Ничего не собиралось и не запускалось, потому что доступен только git, так что код не проверен компилятором.

**Изменённые файлы**
- Изменены:
  - `src/Fulfil/Program.cs`
  - `src/Fulfil/Options/FulfilOptions.cs`
  - `src/Fulfil/appsettings.json`
  - `src/Fulfil/Domain/Order.cs`
  - `src/Fulfil/Ports/Ports.cs`
  - `docker-compose.yml`
- Добавлены:
  - `src/Fulfil/Contracts/OrderFulfilment.cs`
  - `src/Fulfil/Fulfilment/OrderFulfilmentStateMachine.cs`
  - `src/Fulfil/Fulfilment/Consumers.cs`
  - `src/Fulfil/Fulfilment/MessagingSetup.cs`
  - `src/Fulfil/Warehouse/WarehouseInboundService.cs`

**Принятые решения**
- **Потеря событий.** `POST /orders/{id}/submit` обновляет заказ и публикует `OrderSubmitted` через MongoDB-outbox MassTransit в одной транзакции. Поэтому Mongo в compose теперь replica set из одного узла, а строка подключения получила `directConnection=true`. Консьюмеры и сага тоже пишут через outbox/inbox.
- **Сага.** Откат при сбое шага:
  - нет товара — заказ отменяется, откатывать нечего;
  - платёж отклонён или шлюз не ответил после повторов — `ReleaseStock`;
  - сбой отгрузки — `RefundPayment` и `ReleaseStock`.
  - Отмена резерва и возврат платежа не дублируются: резерв хранится в `stock_reservations` (флаг `Released`), платёж в `payments` (статус).
- **Нагрузка на `CapturePayment`.** 10 тыс. в минуту — это около 170 команд в секунду, при ответе шлюза до 2 с. Поэтому у обработчика `ConcurrentMessageLimit` и `PrefetchCount` равны 128 (опция `CapturePaymentConcurrency`). У остальных эндпоинтов prefetch 32. Сбои шлюза повторяются 6 раз с нарастающей паузой, потом сообщение уходит в `_error`, а сага отменяет заказ. Отказ в платеже шлюз сообщает исключением `PaymentDeclinedException`, которое я добавил в `Ports.cs`.
- **Склад.** `WarehouseInboundService` читает `warehouse.inbound` напрямую через `RabbitMQ.Client`: ручной ack, prefetch 50, подключение восстанавливается после рестарта брокера. Повторы отсекаются по `messageId`. Приход и отметка об обработке пишутся в одной транзакции. Подтверждение в `warehouse.outbound` уходит с publisher confirm до ack. Очередь и обменник принадлежат складу, поэтому сервис их проверяет, но не объявляет.

**Что проверить и чего нет**
- **API MassTransit.** Работа с `MongoDbContext` в submit-эндпоинте (`Database`, `Session`, `BeginTransaction`, `CommitTransaction`, `RollbackTransaction`) и настройка `AddMongoDbOutbox` написаны по памяти. Сигнатуры стоит проверить при первой сборке.
- **Шлюз.** Реализации `IPaymentGateway` в репозитории нет (формат вне задачи). Её нужно зарегистрировать в DI, иначе `CapturePayment` не запустится.
- **Идемпотентность списания.** Если процесс упадёт между успешным `ChargeAsync` и записью в `payments`, при повторе возможно двойное списание, если шлюз сам не дедуплицирует по `orderId`.
- **Другие допущения.**
  - `OrderStatus.Submitted` добавлен в конец enum.
  - `ShipOrder` только фиксирует факт отгрузки, потому что внешняя система отгрузки в задаче не описана.
  - Сообщение с некорректным JSON из `warehouse.inbound` отклоняется без возврата в очередь. Если у склада нет dead-letter, оно теряется, поэтому пишется в лог.
