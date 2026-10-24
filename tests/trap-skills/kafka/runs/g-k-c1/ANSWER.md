Задача FUL-11 выполнена в рабочем дереве, без коммита. Проект не собирал и не запускал: из команд доступен только git, а Bash блокировал даже `mkdir`. Код нигде не проверен.

**Изменены:**
- `src/Fulfil/Contracts/OrderEvents.cs`: в `OrderPlaced` добавлено `bool GiftWrap = false`.
- `src/Fulfil/Domain/Order.cs`: добавлено `GiftWrap = false`.
- `src/Fulfil/Options/FulfilOptions.cs`: добавлены топики, группы и `ImportBatchSize`.
- `src/Fulfil/appsettings.json`: добавлены те же значения.
- `src/Fulfil/Program.cs`: регистрация хранилища, издателя и двух фоновых потребителей.

**Созданы:**
- `src/Fulfil/Persistence/MongoOrderStore.cs`
- `src/Fulfil/Messaging/OrderJson.cs`
- `src/Fulfil/Messaging/StatusChangedPublisher.cs`
- `src/Fulfil/Messaging/OrderPlacedConsumer.cs`
- `src/Fulfil/Messaging/OrderImportConsumer.cs`

**Решения:**
- **Старый формат:** отсутствие `giftWrap` при чтении даёт `false`, поэтому принимаются оба формата.
- **Повторы и реплики:** доставка из Kafka «минимум один раз», реплик три. Смещение сохраняется только после учёта и публикации. Повторный заказ отсекается маркером в коллекции `processedOrders` (TTL 30 дней). Монго в стенде одиночный, без транзакций. Сбой между маркером и `$inc` даст недоучёт, а не двойной счёт. Событие `OrderStatusChanged` при повторе может уйти дважды.
- **Импорт:** читаются пачки по 100 сообщений, на каждую один неупорядоченный `InsertMany`. Дубликаты ключей игнорируются, смещения сохраняются после вставки. В памяти держится одна пачка.
- **Сообщения, которые не разобрать:** они логируются без содержимого и пропускаются, мёртвой очереди нет.

**Что проверить с платформой и складом:**
- Для импорта я взял отдельную группу `fulfil-orders-import`, её нужно создать (или поменять в настройках).
- Формат `orders.import` предположил таким же, как `OrderPlaced`.
- Статус в `OrderStatusChanged` сериализуется строкой (`"Placed"`). Склад должен ждать именно её.
