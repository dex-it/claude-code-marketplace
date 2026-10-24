Задача FUL-11 сделана в рабочем дереве, коммита нет. Сборки и тестов не было, так что код не проверен компилятором.

**Изменены:**
- `src/Fulfil/Contracts/OrderEvents.cs`: в `OrderPlaced` добавлено `GiftWrap = false`.
- `src/Fulfil/Domain/Order.cs`: добавлено `GiftWrap = false`.
- `src/Fulfil/Options/FulfilOptions.cs`: темы, группы и размер пачки.
- `src/Fulfil/appsettings.json`: те же настройки.
- `src/Fulfil/Program.cs`: регистрация сервисов и двух фоновых потребителей.

**Новые файлы:**
- `src/Fulfil/Kafka/KafkaSupport.cs`
- `src/Fulfil/Kafka/OrderConsumers.cs`
- `src/Fulfil/Mongo/OrderStores.cs`

**Решения:**
- **Принятые, но не обработанные сообщения:** смещения сохраняются вручную (`EnableAutoOffsetStore=false`, `StoreOffset`) только после обработки. Сбои Mongo и брокера повторяются на месте с задержкой, а не пропускаются. Продьюсер идемпотентный (`acks=all`).
- **Повторная доставка:** проекция `customers` идемпотентна. Идентификаторы учтённых заказов лежат в массиве `processedOrders` документа клиента, проверка и приращение — один атомарный upsert. Массив растёт без ограничений. `InsertMany` для импорта идёт с `IsOrdered=false` и игнорирует дубликаты по `_id`. `OrderStatusChanged` публикуется и для уже учтённого заказа, поэтому склад может получить дубль события.
- **Ядовитые сообщения:** сообщение, которое не разбирается, или без `orderId`, `customerId` и `lines`, уходит в `<топик>.dlq`, и обработка идёт дальше. Старый формат без `giftWrap` читается как `false`.

**Допущения:**
- Импорт читает группа `fulfil-orders-import`, отдельная от `fulfil-orders`. Сообщения в `orders.import` я считал в формате `OrderPlaced`.
- Топики `*.dlq` нужно создать на платформе, если автосоздание топиков выключено.
