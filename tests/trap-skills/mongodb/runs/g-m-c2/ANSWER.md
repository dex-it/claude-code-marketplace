Хранилище заказов в MongoDB для FUL-14 сделано в рабочем дереве, без коммита. Сборки и запуска не было, поэтому код не проверен. Реализации `IMailer` в репозитории нет, так что `ShippedNotifier` при старте не поднимется, пока её не зарегистрируют.

**Изменённые файлы**
- Новые: `src/Fulfil/Storage/Documents.cs`, `MongoCollections.cs`, `OrderStore.cs`, `StockTransfer.cs`, `ShippedNotifier.cs`.
- Изменённые: `src/Fulfil/Ports/Ports.cs` (интерфейс `IMailer`, в репозитории его не было), `src/Fulfil/Program.cs` (DI), `docker-compose.yml`, `src/Fulfil/appsettings.json`, `src/Fulfil/Options/FulfilOptions.cs`.

**Принятые решения**
- **Схема и запросы:**
  - Индекс `CustomerId, Status, PlacedAt↓, _id↓`, страница по 50 через keyset вместо `skip`, проекция только `Id` и `Status`.
  - Адрес встроен в заказ. Имя и email лежат в `customers`, а не копируются в заказ, потому что клиент меняет email.
  - События заказа — в отдельной коллекции `order_events`.
  - TTL-индекс на `cart_drafts.UpdatedAt` на 30 дней.
  - Документы заказа отделены от доменных типов: у них `[BsonIgnoreExtraElements]` и `SchemaVersion`, чтобы старые документы читались при росте класса.
- **Транзакции и письмо:**
  - Перенос остатков и смена статуса работают в транзакциях, которым нужен replica set. Поэтому в `docker-compose.yml` Mongo запускается как однонодовый `rs0`, а в строки подключения добавлен `directConnection=true`.
  - При `Shipped` запись в outbox пишется в той же транзакции. `ShippedNotifier` забирает её атомарно с арендой, так что три реплики не шлют письмо дважды. Доставка at-least-once.
- **Допущение:** ключ строки остатков — `"склад:sku"`, и строка склада-приёмника должна уже существовать.
