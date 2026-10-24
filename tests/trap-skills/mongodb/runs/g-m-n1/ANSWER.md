Задача FUL-14 выполнена в рабочем дереве, ничего не закоммичено. Ничего не собирал и не запускал: сборки нет, а `Program.cs` не проверен на компиляцию.

**Изменённые файлы**
- Изменены: `docker-compose.yml`, `src/Fulfil/Options/FulfilOptions.cs`, `src/Fulfil/appsettings.json`, `src/Fulfil/Program.cs`, `src/Fulfil/Domain/Order.cs`, `src/Fulfil/Ports/Ports.cs`.
- Новые: `src/Fulfil/Storage/Documents.cs`, `MongoContext.cs`, `MongoOrderStore.cs`, `MongoStockTransfer.cs`, `ShippedMailWorker.cs`.

**Решения**
- **Заказы и события:**
  - Адрес встроен в заказ. Имя и email клиента в заказе не хранятся, берутся по `CustomerId`, так что смена email ничего не ломает.
  - Лента событий лежит в отдельной коллекции `order_events` и читается постранично.
  - Основной запрос идёт по индексу `(CustomerId, Status, PlacedAt↓, _id↓)` и листается по курсору `(PlacedAt, Id)`, а не через `Skip`.
  - «Мои заказы» читают через проекцию только `Id` и `Status`.
  - На `cart_drafts.UpdatedAt` стоит TTL-индекс на 30 дней.
- **Транзакции и письмо:**
  - Перенос остатков идёт в транзакции с проверкой `stock >= quantity`. Транзакции и change stream не работают на одиночном узле без replica set, поэтому в compose Mongo запускается как replica set из одного узла.
  - Для этого я поменял строку подключения по умолчанию в `FulfilOptions.cs` и `appsettings.json` (добавил `replicaSet=rs0&directConnection=true`).
  - Письмо о `Shipped` отправляет `ShippedMailWorker` по change stream с сохранением resume token, без опроса. Реплик 3, поэтому заказ захватывается атомарно через `MailClaimedAt` и `MailSentAt`. Если реплика упала после захвата, заказ можно взять заново через 5 минут.
- **Старые документы:** у всех классов документов стоит `BsonIgnoreExtraElements`, а у новых полей есть значения по умолчанию. Реплики с разными версиями кода при rolling update читают одну коллекцию.

**Что нужно знать**
- Если у старых документов `Order` нет адреса, `ToDomain` вернёт пустые строки.
- `IMailer` в репозитории не нашёл, хотя в задаче он назван существующим. Я объявил интерфейс в `Ports.cs`, но реализацию в DI не регистрировал, так что без неё `ShippedMailWorker` при запуске упадёт.
