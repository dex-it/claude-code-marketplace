Задача FUL-11 выполнена в рабочем дереве, ничего не закоммичено. Код не собирался и не запускался, потому что доступен только git.

**Изменены:**
- `src/Fulfil/Contracts/OrderEvents.cs` — в `OrderPlaced` добавлено `bool GiftWrap = false`
- `src/Fulfil/Options/FulfilOptions.cs` — группа, имена топиков, суффикс DLQ, размер пачки
- `src/Fulfil/Program.cs` — регистрация Mongo, продьюсера и двух фоновых потребителей

**Добавлены:**
- `src/Fulfil/Kafka/KafkaPublisher.cs`
- `src/Fulfil/Kafka/ConsumerWorker.cs`
- `src/Fulfil/Kafka/OrderPlacedWorker.cs`
- `src/Fulfil/Kafka/OrderImportWorker.cs`
- `src/Fulfil/Mongo/MongoStores.cs`

**Решения:**
- **Дисциплина Kafka:**
  - Продьюсер идемпотентный (`EnableIdempotence`, `Acks.All`).
  - У потребителей отключены автосохранение смещений и включён автокоммит. Смещение сохраняется только после обработки: у `orders.placed` — после проекции и публикации, у `orders.import` — после записи всей пачки. Стратегия назначения партиций — `CooperativeSticky`.
  - Сообщение, которое не разобрать как JSON, уходит в `<топик>.dlq` с причиной в заголовке, и партиция не блокируется. Временные сбои Mongo и Kafka повторяются с задержкой, сообщение не пропускается.
- **Повторная доставка:**
  - Заказ в проекции клиента учитывается один раз. Для этого `customers` хранит последние 1000 `recentOrderIds`, а проверка и `$inc` делаются одним атомарным обновлением. Transaction на одиночном Mongo нет.
  - Импорт пишет через `InsertMany` с `IsOrdered=false` и `_id` равным id заказа, дубликаты после повтора отбрасываются.
  - `OrderStatusChanged` при повторе уйдёт ещё раз, склад должен отличать события по `OrderId`.
- **Формат:** старый `OrderPlaced` без `giftWrap` читается как `false`. Формат сообщений `orders.import` в задаче не описан, я принял его за `OrderPlaced`.

Платформе нужно создать топики `orders.placed.dlq` и `orders.import.dlq`: если их нет, публикация в DLQ будет повторяться бесконечно. Группа `fulfil-orders` используется и для `orders.import`.
