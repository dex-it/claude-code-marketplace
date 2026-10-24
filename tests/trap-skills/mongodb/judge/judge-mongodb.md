# Судья: СКИЛЛ=mongodb (кейсы g-m, rv-m)

## g-m (код, order-history, G-M). Пути - в DIFF.patch прогона
| единица | c1 | c2 | основание |
|---|---|---|---|
| M1 | 1 | 1 | c1: MongoContext singleton, `new MongoClient` в ctor (MongoContext.cs:~20, Program.cs AddSingleton); c2: `AddSingleton<IMongoClient>` (Program.cs) |
| M2 | 1 | 1 | c1/c2: коллекция `order_events` с OrderId (OrderEventDocument, GetEventsAsync постранично) |
| M3 | 1 | 1 | OrderDocument только CustomerId, отдельная `customers` |
| M4 | 1 | 1 | ShippingAddress встроен в OrderDocument |
| M5 | 1 | 1 | индекс `customer_status_placed` в EnsureIndexesAsync (MongoContext.cs / MongoCollections.cs), вызывается из воркера при старте |
| M6 | 1 | 1 | CustomerId, Status, PlacedAt desc, Id desc |
| M7 | 1 | 1 | TTL `ExpireAfter` 30 суток по UpdatedAt |
| M8 | 1 | 1 | c1: `Project(OrderListItem(Id,Status,PlacedAt))`; c2: `Project(OrderSummary(Id,Status))` |
| M9 | 0 ? | 0 ? | оба: outbox в транзакции смены статуса, но письмо шлёт воркер опросом `FindOneAndUpdate` + `Task.Delay` (c1 ShippedMailWorker Idle 2с, c2 ShippedNotifier Idle 5с) - по тексту ключа это опрос по таймеру; Change Streams нет. Спорно: реакция «в коде, меняющем статус» не сделана, но это outbox с арендой, replica set есть |
| M10 | 1 | 1 | `[BsonIgnoreExtraElements]` на всех документах (Documents.cs); атрибут допустим |
| M11 | 1 | 1 | replica set `--replSet rs0` в compose + directConnection + WithTransactionAsync (StockTransfer.cs) |

## rv-m (ревью, order-archive)
| единица | c1 | c2 | основание |
|---|---|---|---|
| M1 | 1 | 1 | OrderStore.cs:18 / 17-18, blocker, утечка сокетов/потоков |
| M2 | 1 | 1 | OrderEvents.cs:14/15, 16 МБ, minor (severity не требуется) |
| M3 | 0 | 0 | находки про копию имени/email в заказе нет в обоих |
| M4 | 1 | 1 | c1 OrderStore.cs:39 (заказ без адреса, Address=null; minor); c2 OrderStore.cs:38-40 (два запроса, заказ без адреса) |
| M5 | 1 | 1 | c1 ArchiveInitializer.cs:13 (нет индекса customerId,status,placedAt, scan); c2 OrderStore.cs:55 (нет индекса, scan) |
| M6 | 1 | 1 | ArchiveInitializer.cs:18, порядок at desc,toWarehouse,sku против sku,toWarehouse,at |
| M7 | 1 | 1 ? | c1 CartDraftCleaner.cs:13 прямо предлагает TTL; c2 :13 называет только отсутствие индекса и полный скан раз в час, TTL не называет - принято по последствию из ключа (скан без индекса), спорно |
| M8 | 0 | 0 | ListMineAsync (OrderStore.cs:63-69) без находки про полный документ; ExportAsync :73 - это P1, не M8 |
| M9 | 0 | 0 | ShippedWatcher.cs:29-41 опрос + Delay не назван; находки про исключения/claim, не про опрос |
| M10 | 0 | 0 | отсутствие IgnoreExtraElements не названо (c2 MongoConventions.cs:21 - про StartsWith, другая тема) |
| M11 | 1 | 1 | StockTransfer.cs:36 / 36-37, standalone mongod, текст ошибки, blocker |
| P1 | 0 | 1 | c1 OrderStore.cs:73 ExportAsync - major (OOM, просит стриминг/проекцию); c2 :73 - minor |
| P2 | 1 | 1 | c1 не заявлена; c2 OrderStore.cs:33 `Take(MaxTags)` - minor, не провал |
| O1 | 1 | 1 | double вместо decimal: c1 OrderDoc.cs:27/OrderStore.cs:31; c2 OrderStore.cs:31 |
| O2 | 1 | 1 | c1 OrderStore.cs:57 (minor, назван пропуск первой страницы); c2 :57 major |

Н (сверх ключа, признаю настоящими): ReplaceOne+upsert затирает Events/Mailed (OrderStore.cs:35-36, оба); Mailed=true до отправки, письмо теряется (ShippedWatcher.cs:46-55, оба); LogMailer - единственный IMailer, письма не уходят (оба); исключение из NotifyAsync прерывает обход пакета (оба); CartDraftCleaner без try/catch роняет хост (оба); архив не подключён ни к одному пути вызова (оба); ExportAsync без лимита/курсора (c1, по сути P1); c2 - Task.Delay вне try при остановке; c2 - StartsWith без точки в MongoConventions.cs:21. В g-m: оба прогона объявили IMailer в Ports.cs, реализации и регистрации нет (сервис не стартует) - в ключ не входит.

## Итог по единице (g-m + rv-m, 4 клетки)
| единица | итог |
|---|---|
| M1 | 2/2 |
| M2 | 2/2 |
| M3 | код 2/2, ревью 0/2 |
| M4 | 2/2 |
| M5 | 2/2 |
| M6 | 2/2 |
| M7 | 2/2 (ревью c2 спорно ?) |
| M8 | код 2/2, ревью 0/2 |
| M9 | код 0/2 ?, ревью 0/2 |
| M10 | код 2/2, ревью 0/2 |
| M11 | 2/2 |
| P1 | 1/2 (c1 провал) |
| P2 | 2/2 |
| O1 | 2/2 |
| O2 | 2/2 |
