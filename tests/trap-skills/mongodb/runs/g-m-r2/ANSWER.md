Хранилище заказов для FUL-14 готово в рабочем дереве, ничего не закоммичено. Сборки и тестов не было, поэтому код не компилировался и не запускался.

**Новые файлы** (все в `src/Fulfil/Storage/`):
- `Documents.cs`
- `MongoContext.cs`
- `OrderRepository.cs`
- `StockTransfer.cs`
- `ShippedOrderWatcher.cs`

**Изменены:**
- `src/Fulfil/Ports/Ports.cs`
- `src/Fulfil/Program.cs`
- `src/Fulfil/Options/FulfilOptions.cs`
- `src/Fulfil/appsettings.json`
- `docker-compose.yml`

**Принятые решения:**
- **Данные заказа:**
  - Адрес вложен в документ заказа.
  - Имя и email клиента не копируются, в заказе лежит только `CustomerId`. Почту по нему определяет мейлер при отправке.
  - События заказа вынесены в коллекцию `order_events` с постраничным чтением, потому что их тысячи.
  - «Мои заказы» читают через проекцию только номер и статус.
- **Индексы и старые документы:**
  - Основной запрос идёт по индексу `{CustomerId, Status, PlacedAt↓}`.
  - У `cart_drafts` стоит TTL-индекс на 30 дней по `UpdatedAt`.
  - На всех документах стоит `BsonIgnoreExtraElements`, так что старые документы читаются без ошибок.
- **Replica set и письма:**
  - Монго в `docker-compose.yml` поднят одним узлом как replica set `rs0`. Без этого нет транзакций для переноса остатков и нет change stream. В строку подключения добавлен `directConnection=true`.
  - `ShippedOrderWatcher` реагирует на `Shipped` через change stream. Реплик три, поэтому письмо захватывается вставкой в `shipped_mail` по `orderId`, а позиция потока общая.

**Что нужно проверить:**
- `IMailer` в коде не нашёлся. Я добавил интерфейс в `Ports.cs` с сигнатурой `SendShippedAsync(Guid orderId)`. Реализации нет, поэтому до её регистрации в DI сервис не стартует.
- `appsettings.json` и значение по умолчанию в `FulfilOptions.cs` поменялись на строку с `directConnection=true`. Если в окружениях строка задаётся переменной, её нужно обновить там же.
- Коллекцию `warehouse_stock` я заполнять не стал, остатки в неё должен кто-то завести.
