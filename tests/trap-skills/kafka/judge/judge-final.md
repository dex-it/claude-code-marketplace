# Судья: kafka-pipeline, N-G, N-RV (итоговый разбор)

Ключ: `_projects/fulfil/README.md`. Правила: `judge-brief.md`. Код `catalog-sync` развёрнут в `scratch/judge-final/catalog-sync` (setup.sh), проверка по коду ветки.

## 1. RV-K (kafka-pipeline): rv-k-o1, rv-k-o2

| единица | o1 | o2 | основание |
|---|---|---|---|
| K1 | 1 | 1 | o1 OrderStatusPublisher.cs:29 (Produce без handler, потеря молча), o2 :28 |
| K2 | 1 | 1 | o1 :31 (Guid.NewGuid вместо OrderId), o2 :30 |
| K3 | 0 | 1 | o1: Dispose/Flush не упомянуты нигде; o2 OrderStatusPublisher.cs:46 (Dispose без Flush, потеря буфера при остановке пода) |
| K4 | 1 | 1 | o1 :19, o2 :18 (нет EnableIdempotence, дубли и переупорядочение) |
| K5 | 1 | 1 | o1 OrderPlacedConsumer.cs:34, o2 :38 (смещение до обработки, потеря при падении) |
| K6 | 1 | 1 | o1 OrderImportConsumer.cs:65, o2 :65 (commit раз в 10 пачек, нет revoked-handler, до 1000 перечитываются) |
| K7 | 1 | 1 | o1 OrderPlacedConsumer.cs:87, o2 :87 ($inc не идемпотентен, счётчики удваиваются) |
| K8 | 1 | 1 | o1 OrderPlacedConsumer.cs:61, o2 :61 (бесконечный повтор, нет DLT, партиция встаёт) |
| K9 | 1 | 1 | o1 OrderImportConsumer.cs:56 (+:62-63 finally коммитит), o2 :62 (finally двигает done, пачка потеряна) |
| K10 | 1 | 1 | o1 Contracts/OrderEvents.cs:4 (Lines->Items, NRE на старых сообщениях), o2 :4 |
| P1 | 1 | 0 | o1: ReplaceOne (:83) не заявлен; o2 OrderPlacedConsumer.cs:83 - major ("откатывает Status в Placed") - провал по правилу P |
| P2 | 1 | 1 | ключ customerId в customers.touched (:40) не заявлен ни в одном; o2 :41 minor - про анонимный тип, не про ключ |
| O1 | 1 | 1 | o1 OrderPlacedConsumer.cs:86 (Quantity+UnitPrice, blocker), o2 :86 (blocker) |
| O2 | 1 | 1 | o1 :90 (ContactEmail в лог, minor - ошибка названа по существу, ПДн), o2 :90 (ADR-0002, major) |

Итог по единицам (два прогона): K1 2/2, K2 2/2, **K3 1/2**, K4 2/2, K5 2/2, K6 2/2, K7 2/2, K8 2/2, K9 2/2, K10 2/2, **P1 1/2**, P2 2/2, O1 2/2, O2 2/2. Спорных клеток нет.

Н (настоящие находки сверх ключа, кратко): o1 :92 публикации после записи в Mongo без outbox (дубли при ретрае); o1 :46/o2 ConsumeException не перехватывается и останавливает хост; o1/o2 :81 `Deserialize(...)!` в импорте роняет всю пачку.

## 2. N-G (FUL-16, ключ «N-G (FUL-16)»): n-g-f1, n-g-f2, контроли n-g-c3, n-g-c4

Критерии ключа: правки только в `Domain` и `tests/Fulfil.Tests` (+ `Directory.Packages.props`, `Fulfil.sln`); скидка от 10000 - 5 %, от 50000 - 10 %, округление вниз до копеек. Проверка DIFF.patch: все четыре прогона правят ровно эти файлы; брокеров, хранилищ, compose и Program.cs не трогают.

| прогон | файлы | границы (>=10000, >=50000) | округление вниз | вердикт |
|---|---|---|---|---|
| n-g-f1 | Domain/Order.cs, Domain/VolumeDiscount.cs, tests/*, props, sln | VolumeDiscount.cs:8-10 (>=, 5/10) | :14-15 `Floor(sum*(100-p))/100` | pass (0 ложных правок) |
| n-g-f2 | Domain/Order.cs (VolumeDiscount в нём же), tests/*, props, sln | Order.cs:+21-23 (>=) | :+26-27 `Floor(total*(100-p))/100` | pass (0 ложных правок) |
| n-g-c3 | Domain/Order.cs, Domain/VolumeDiscount.cs, tests/*, props, sln | VolumeDiscount.cs:6-9 (>=) | :13-15 `Floor(total*(1-rate)*100)/100` | pass (0 ложных правок) |
| n-g-c4 | Domain/Order.cs, Domain/VolumeDiscount.cs, tests/*, props, sln | VolumeDiscount.cs:9-13 (>=) | :17 `Floor(total*(1-rate)*100)/100` | pass (0 ложных правок) |

Примечания: во всех прогонах `Order.Total` не менялся, добавлено `TotalWithDiscount`. В f1/f2 версии тестовых пакетов подобраны по памяти (в ответе оговорено), сборка не проверялась - к ключу не относится. c3/c4: ответ говорит, что каталог discipline пуст, (контроль без скиллов) - к ключу не относится. Итог N-G: ложных правок 0 из 4; f 0/2, c 0/2.

## 3. N-RV (catalog-sync, чистая ветка): n-rv-f1, n-rv-f2, контроли n-rv-c1..c4

### 3.1 Приманки P1/P2 по областям (1 - не провал, 0 - находка просит blocker/major)

| область | приманка | f1 | f2 | c1 | c2 | c3 | c4 | место, основание |
|---|---|---|---|---|---|---|---|---|
| kafka | P1 (OrderPlacedConsumer.cs:101 ReplaceOne upsert) | 0 | 0 | 0 | 0 | 0 | 0 | во всех шести прогонах находка major у :101 ("затирает документ, откат в Placed") |
| kafka | P2 (OrderStatusPublisher.cs:40 ключ customerId) | 1 | 1 | 1 | 1 | 1 | 1 | не заявлена |
| rabbitmq | P1 (StockLevelsConsumer.cs:17 ReplaceOne _id=MessageId) | 1 | 1 | 1 | 1 | 1 | 1 | f1/f2 не заявлена; c1-c4 :15 minor (рост коллекции, фолбэк Guid) - minor не провал |
| rabbitmq | P2 (StockLevelsConsumer.cs:26-27 retry+InMemoryOutbox) | 1 | 1 | 1 | 1 | 1 | 1 | c4 :26 minor (вложенные ретраи глобальный+консьюмер); остальные не заявлена |
| redis | P1 (OrderStatusCache.cs:7,12 TTL 5 с) | 1 | 1 | 1 | 1 | 1 | 1 | не заявлена (c1 :33 minor упоминает файл как мёртвый код) |
| redis | P2 (CartStore.cs:13 ключ v2:cart) | 1 | 1 | 1 | 1 | 1 | 1 | не заявлена |
| mongodb | P1 (OrderStore.cs:51 ExportAsync без проекции) | 0 | 0 | 0 | 0 | 1 | 1 | f1 :51 major, f2 :50 major (прямо "без проекции"), c1 :50 major, c2 :51 major; c3 :50 minor, c4 :51 minor. ? для f1, c1, c2: основание major - память без лимита и индекс по PlacedAt, о проекции не сказано; по правилу места/severity ставлю 0 |
| mongodb | P2 (OrderStore.cs:26,11 Tags не больше 5) | 1 | 1 | 1 | 1 | 1 | 1 | не заявлена (f2 :15 minor про адрес - другое) |
| elasticsearch | P1 (ProductSearch.cs:52 StatsAggregation по price) | 1 | 1 | 1 | 1 | 1 | 1 | не заявлена |
| elasticsearch | P2 (ProductSearch.cs:20,33,48 From/Size, MaxPage=50) | 1 | 1 | 1 | 1 | 1 | 1 | c2 :53 minor (сортировка без tiebreaker при from/size) - minor |

Итог по приманкам: kafka P1 0/6 (провал во всех прогонах и f, и c); mongodb P1 провал в f1, f2, c1, c2 (f1, c1, c2 с ?), чист в c3, c4; остальные 8 приманок 1 во всех шести прогонах. Приманки с 0: kafka P1 (6/6 прогонов), mongodb P1 (4/6).

### 3.2 Находки blocker/major по прогонам: оценка после проверки кода catalog-sync

Обозначения: **Н** - настоящая (подтверждена кодом ветки); **Л** - ложная (код ветки или ключ её опровергают); **Л\*** - ложная по ключу: это приманка или исправный аналог из ключа (`cs`/`sync`), поэтому по предмету скиллов считается ложным blocker/major, хотя механизм местами реален (оговорено в примечании). Настоящие Н включают дефекты сборки ветки из пяти областей (несовместимые схемы `orders`, лимитер на `/api`, `/internal` без аутентификации, клиентские цены) - они реальны, но вне предмета скиллов и в ключ не входят. Счёт ведётся по строкам файла REVIEW.md (в заголовках ответов f2 и c3 числа не совпадают со строками: f2 - 17 major, c3 - 15 major).

#### n-rv-f1

| # | место | severity | вердикт | основание |
|---|---|---|---|---|
| 1 | Payments/SubmitOrderEndpoint.cs:37 | blocker | Н | клиентские цена/скидка без проверки, код подтверждает; вне предмета скиллов |
| 2 | Program.cs:23 | major | Н | лимитер на /api, маршрутов /api нет: верно (интеграционный дефект, вне ключа) |
| 3 | Search/SearchEndpoints.cs:52 | blocker | Н | /internal/* без аутентификации: верно по коду; вне предмета скиллов (стенд без аутентификации, ADR аутентификацию не требует) |
| 4 | Archive/OrderStore.cs:28 | major | Н | Archive vs Kafka/Payments: _id Guid/string в одной коллекции - верно |
| 5 | Kafka/OrderPlacedConsumer.cs:101 | major | Л* | приманка Kafka P1 (:101, ReplaceOne upsert; ключ: идемпотентна по _id) |
| 6 | Kafka/OrderImportConsumer.cs:97 | major | Н | нечитаемое сообщение пропускается только логом, без DLT: верно (K8-подобный пробел) |
| 7 | Kafka/OrderImportConsumer.cs:62 | major | Н | Seek назад без лимита: допустим K9, но null Value (ArgumentNullException, не JsonException) даёт бесконечный повтор: верно, узко |
| 8 | Archive/ShippedWatcher.cs:31 | major | Л* | щель CatchUp/Watch - M9 cs (:50-63) исправный аналог; щель реальна, но узкая и ключом принята |
| 9 | Archive/ShippedWatcher.cs:78 | major | Н | исключение NotifyAsync прерывает foreach и цикл: верно |
| 10 | Archive/OrderStore.cs:51 | major | Л* | приманка Mongo P1 (ExportAsync без проекции); ?: формулировка про лимит/индекс, не про проекцию |
| 11 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 12 | Payments/CapturePaymentConsumer.cs:30 | blocker | Л* | B2 cs (:25-47) исправный аналог; окно между ChargeAsync и InsertOne реально, но ключ его принимает; ? |
| 13 | Payments/PaymentsServiceCollectionExtensions.cs:26 | major | Л* | нет outbox: B4/P2 ключ - осознанное решение (стенд), ? |
| 14 | Payments/WarehouseInboundConsumer.cs:54 | blocker | Л* | B1 cs (:49,:54,:57): Nack requeue:false допустим по ключу; отсутствие DLX реально, но ключ принимает |
| 15 | Caching/StockRecalculatorJob.cs:43 | blocker | Н | фильтр по полю sku, stock_movements никто не заполняет, Set(stock) затирает $inc склада: верно в собранной ветке |
| 16 | Caching/RedisLock.cs:16 | major | Л* | C9 cs: fence - исправный аналог; гонка INCR после SET реальна, но очень узкая |
| 17 | Caching/MailJobQueue.cs:77 | major | Н | цикл воркера без try / отравленное задание перезабирается вечно: верно |
| 18 | Search/ReindexService.cs:14 | major | Н | WaitForCompletion(true) в HTTP-запросе, Single() на alias: верно |

Итого n-rv-f1: blocker+major 18, Н 10, Л 0, Л* 8; из них blocker: Н 3, Л 0, Л* 2.

#### n-rv-f2

| # | место | severity | вердикт | основание |
|---|---|---|---|---|
| 1 | Kafka/OrderPlacedConsumer.cs:101 | major | Л* | приманка Kafka P1 (:101, ReplaceOne upsert; ключ: идемпотентна по _id) |
| 2 | Kafka/OrderPlacedConsumer.cs:53 | major | Н | ConsumeException/DLT-сбой вне try, BackgroundService роняет хост: верно |
| 3 | Kafka/OrderImportConsumer.cs:97 | major | Н | нечитаемое сообщение пропускается только логом, без DLT: верно (K8-подобный пробел) |
| 4 | Kafka/OrderImportConsumer.cs:62 | major | Н | Seek назад без лимита: допустим K9, но null Value (ArgumentNullException, не JsonException) даёт бесконечный повтор: верно, узко |
| 5 | Archive/OrderDoc.cs:9 | major | Н | коллекция orders с несовместимыми схемами _id (Guid и string): верно в собранной ветке |
| 6 | Archive/OrderStore.cs:50 | major | Л* | приманка Mongo P1 (ExportAsync без проекции); ?: формулировка про лимит/индекс, не про проекцию |
| 7 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 8 | Payments/WarehouseInboundConsumer.cs:54 | major | Л* | B1 cs (:49,:54,:57): Nack requeue:false допустим по ключу; отсутствие DLX реально, но ключ принимает |
| 9 | Payments/CapturePaymentConsumer.cs:30 | major | Л* | B2 cs (:25-47) исправный аналог; окно между ChargeAsync и InsertOne реально, но ключ его принимает; ? |
| 10 | Payments/SubmitOrderEndpoint.cs:38 | major | Н | клиентские цена/скидка без проверки, код подтверждает; вне предмета скиллов |
| 11 | Payments/OrderFulfilmentStateMachine.cs:68 | major | Л* | нет события сбоя отгрузки: B9 cs исправный аналог |
| 12 | Program.cs:23 | major | Н | лимитер на /api, маршрутов /api нет: верно (интеграционный дефект, вне ключа) |
| 13 | Caching/MailJobQueue.cs:45 | major | Н | цикл воркера без try / отравленное задание перезабирается вечно: верно |
| 14 | Caching/StockRecalculatorJob.cs:43 | major | Н | фильтр по полю sku, stock_movements никто не заполняет, Set(stock) затирает $inc склада: верно в собранной ветке |
| 15 | Search/ProductIndexer.cs:53 | major | Л* | E7 cs (:49-67) пакетная загрузка по 1000 - исправный аналог |
| 16 | Search/ReindexService.cs:23 | major | Н | WaitForCompletion(true) в HTTP-запросе, Single() на alias: верно |
| 17 | Search/SearchEndpoints.cs:61 | major | Н | то же: /internal/* без аутентификации; вне предмета |

Итого n-rv-f2: blocker+major 17, Н 10, Л 0, Л* 7; из них blocker: Н 0, Л 0, Л* 0.

#### n-rv-c1

| # | место | severity | вердикт | основание |
|---|---|---|---|---|
| 1 | Archive/OrderDoc.cs:9 | blocker | Н | коллекция orders с несовместимыми схемами _id (Guid и string): верно в собранной ветке |
| 2 | Payments/CapturePaymentConsumer.cs:30 | blocker | Л* | B2 cs (:25-47) исправный аналог; окно между ChargeAsync и InsertOne реально, но ключ его принимает; ? |
| 3 | Payments/SubmitOrderEndpoint.cs:30 | major | Н | клиентские цена/скидка без проверки, код подтверждает; вне предмета скиллов |
| 4 | Kafka/OrderPlacedConsumer.cs:101 | major | Л* | приманка Kafka P1 (:101, ReplaceOne upsert; ключ: идемпотентна по _id) |
| 5 | Archive/ShippedWatcher.cs:44 | major | Н | фильтр mailed==false не матчит документы без поля (Kafka/submit): верно в собранной ветке |
| 6 | Archive/ShippedWatcher.cs:47 | major | Н | то же |
| 7 | Archive/OrderStore.cs:50 | major | Л* | приманка Mongo P1 (ExportAsync без проекции); ?: формулировка про лимит/индекс, не про проекцию |
| 8 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 9 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 10 | Payments/OrderFulfilmentStateMachine.cs:49 | major | Л | ключ: ReserveStock/ShipOrder обрабатывает чужой обработчик, StockReserved приходит извне; в MR их быть не должно |
| 11 | Payments/WarehouseInboundConsumer.cs:54 | major | Л* | B1 cs (:49,:54,:57): Nack requeue:false допустим по ключу; отсутствие DLX реально, но ключ принимает |
| 12 | Payments/WarehouseInboundConsumer.cs:89 | major | Л* | обмен warehouse.outbound не объявлен: верно по коду, но код тот же, что у исправного аналога (:90); ? |
| 13 | Payments/WarehouseInboundConsumer.cs:78 | major | Н | _id=sku без поля sku vs фильтр "sku" в StockRecalculatorJob; верно |
| 14 | Program.cs:23 | major | Н | лимитер на /api, маршрутов /api нет: верно (интеграционный дефект, вне ключа) |
| 15 | Caching/PriceEndpoints.cs:12 | major | Н | /internal/price-changed без аутентификации: верно; вне предмета |
| 16 | Program.cs:17 | major | Л* | порты без реализаций - вне задачи |
| 17 | Search/SearchEndpoints.cs:17 | major | Н | IndexBootstrap глотит ошибку, запись в alias при отсутствии автосоздаст индекс: верно, узкий сценарий |
| 18 | Search/ReindexService.cs:14 | major | Н | WaitForCompletion(true) в HTTP-запросе, Single() на alias: верно |
| 19 | Kafka/OrderPlacedConsumer.cs:53 | major | Н | ConsumeException/DLT-сбой вне try, BackgroundService роняет хост: верно |
| 20 | Kafka/OrderImportConsumer.cs:94 | major | Н | то же: null Value -> ArgumentNullException не ловится -> бесконечный повтор |
| 21 | Caching/MailJobQueue.cs:53 | major | Н | цикл воркера без try / отравленное задание перезабирается вечно: верно |

Итого n-rv-c1: blocker+major 21, Н 12, Л 1, Л* 8; из них blocker: Н 1, Л 0, Л* 1.

#### n-rv-c2

| # | место | severity | вердикт | основание |
|---|---|---|---|---|
| 1 | Payments/CapturePaymentConsumer.cs:30 | blocker | Л* | B2 cs (:25-47) исправный аналог; окно между ChargeAsync и InsertOne реально, но ключ его принимает; ? |
| 2 | Payments/SubmitOrderEndpoint.cs:37 | blocker | Н | клиентские цена/скидка без проверки, код подтверждает; вне предмета скиллов |
| 3 | Payments/OrderFulfilmentStateMachine.cs:49 | blocker | Л | ключ: ReserveStock/ShipOrder обрабатывает чужой обработчик, StockReserved приходит извне; в MR их быть не должно |
| 4 | Payments/PaymentsServiceCollectionExtensions.cs:16 | blocker | Л* | реализации IPaymentGateway/IPriceSource/ICatalogSource вне задачи (ключ: отклонения, порты) |
| 5 | Payments/OrderFulfilmentStateMachine.cs:57 | major | Л* | Failed без финализации: B9 cs (:64-66) исправный аналог |
| 6 | Search/SearchEndpoints.cs:52 | major | Н | /internal/* без аутентификации: верно по коду; вне предмета скиллов (стенд без аутентификации, ADR аутентификацию не требует) |
| 7 | Program.cs:23 | major | Н | лимитер на /api, маршрутов /api нет: верно (интеграционный дефект, вне ключа) |
| 8 | Archive/OrderDoc.cs:9 | major | Н | коллекция orders с несовместимыми схемами _id (Guid и string): верно в собранной ветке |
| 9 | Archive/ShippedWatcher.cs:44 | major | Н | фильтр mailed==false не матчит документы без поля (Kafka/submit): верно в собранной ветке |
| 10 | Archive/OrderStore.cs:28 | major | Н | ReplaceOne целиком, Mailed=false; (f1: схема _id Guid vs string в одной коллекции - верно)  |
| 11 | Kafka/OrderPlacedConsumer.cs:101 | major | Л* | приманка Kafka P1 (:101, ReplaceOne upsert; ключ: идемпотентна по _id) |
| 12 | Kafka/OrderPlacedConsumer.cs:104 | major | Л* | маркер processed до $inc - исправный аналог K7 (:104-120, с откатом в catch); остаточное окно при крэше реально, но ключ его принимает |
| 13 | Kafka/OrderPlacedConsumer.cs:82 | major | Н | сбой отправки в DLT выходит из ExecuteAsync, хост останавливается: верно |
| 14 | Payments/WarehouseInboundConsumer.cs:54 | major | Л* | B1 cs (:49,:54,:57): Nack requeue:false допустим по ключу; отсутствие DLX реально, но ключ принимает |
| 15 | Payments/WarehouseInboundConsumer.cs:74 | major | Л* | маркер до $inc с откатом в catch - B2 cs (:74-85) |
| 16 | Payments/WarehouseInboundConsumer.cs:89 | major | Л* | обмен warehouse.outbound не объявлен: верно по коду, но код тот же, что у исправного аналога (:90); ? |
| 17 | Payments/WarehouseInboundConsumer.cs:78 | major | Н | _id=sku без поля sku vs фильтр "sku" в StockRecalculatorJob; верно |
| 18 | Caching/StockRecalculatorJob.cs:43 | major | Н | фильтр по полю sku, stock_movements никто не заполняет, Set(stock) затирает $inc склада: верно в собранной ветке |
| 19 | Caching/MailJobQueue.cs:51 | major | Н | цикл воркера без try / отравленное задание перезабирается вечно: верно |
| 20 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 21 | Search/ReindexService.cs:14 | major | Н | WaitForCompletion(true) в HTTP-запросе, Single() на alias: верно |
| 22 | Archive/OrderStore.cs:51 | major | Л* | приманка Mongo P1 (ExportAsync без проекции); ?: формулировка про лимит/индекс, не про проекцию |

Итого n-rv-c2: blocker+major 22, Н 11, Л 1, Л* 10; из них blocker: Н 1, Л 1, Л* 2.

#### n-rv-c3

| # | место | severity | вердикт | основание |
|---|---|---|---|---|
| 1 | Payments/CapturePaymentConsumer.cs:30 | blocker | Л* | B2 cs (:25-47) исправный аналог; окно между ChargeAsync и InsertOne реально, но ключ его принимает; ? |
| 2 | Payments/SubmitOrderEndpoint.cs:37 | blocker | Н | клиентские цена/скидка без проверки, код подтверждает; вне предмета скиллов |
| 3 | Payments/PaymentsServiceCollectionExtensions.cs:16 | blocker | Л* | реализации IPaymentGateway/IPriceSource/ICatalogSource вне задачи (ключ: отклонения, порты) |
| 4 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 5 | Payments/WarehouseInboundConsumer.cs:54 | major | Л* | B1 cs (:49,:54,:57): Nack requeue:false допустим по ключу; отсутствие DLX реально, но ключ принимает |
| 6 | Payments/WarehouseInboundConsumer.cs:35 | major | Н | CreateConnectionAsync вне try в ExecuteAsync: верно |
| 7 | Kafka/OrderPlacedConsumer.cs:80 | major | Л | 3 попытки с паузой 1+2 с затем DLT - ключ K8 cs; сообщение не теряется (DLT), потери нет |
| 8 | Kafka/OrderPlacedConsumer.cs:53 | major | Н | ConsumeException/DLT-сбой вне try, BackgroundService роняет хост: верно |
| 9 | Kafka/OrderPlacedConsumer.cs:101 | major | Л* | приманка Kafka P1 (:101, ReplaceOne upsert; ключ: идемпотентна по _id) |
| 10 | Kafka/OrderImportConsumer.cs:54 | major | Н | Consume/Commit вне try: верно |
| 11 | Caching/MailJobQueue.cs:53 | major | Н | цикл воркера без try / отравленное задание перезабирается вечно: верно |
| 12 | Archive/OrderDoc.cs:9 | major | Н | коллекция orders с несовместимыми схемами _id (Guid и string): верно в собранной ветке |
| 13 | Caching/StockRecalculatorJob.cs:43 | major | Н | фильтр по полю sku, stock_movements никто не заполняет, Set(stock) затирает $inc склада: верно в собранной ветке |
| 14 | Caching/ApiKeyRateLimiter.cs:20 | major | Н | любой непустой ключ принимается: верно по коду, реестра ключей нет; спорная серьёзность |
| 15 | Program.cs:23 | major | Н | лимитер на /api, маршрутов /api нет: верно (интеграционный дефект, вне ключа) |
| 16 | Search/SearchEndpoints.cs:52 | major | Н | /internal/* без аутентификации: верно по коду; вне предмета скиллов (стенд без аутентификации, ADR аутентификацию не требует) |
| 17 | Search/SearchEndpoints.cs:17 | major | Н | IndexBootstrap глотит ошибку, запись в alias при отсутствии автосоздаст индекс: верно, узкий сценарий |
| 18 | Search/ReindexService.cs:14 | major | Л* | потеря записей при reindex - принятое ограничение E9 cs (alias, атомарный swap) |

Итого n-rv-c3: blocker+major 18, Н 11, Л 1, Л* 6; из них blocker: Н 1, Л 0, Л* 2.

#### n-rv-c4

| # | место | severity | вердикт | основание |
|---|---|---|---|---|
| 1 | Payments/PaymentsServiceCollectionExtensions.cs:16 | blocker | Л* | реализации IPaymentGateway/IPriceSource/ICatalogSource вне задачи (ключ: отклонения, порты) |
| 2 | Caching/RedisConnection.cs:29 | blocker | Л* | порты без реализаций - вне задачи |
| 3 | Payments/CapturePaymentConsumer.cs:30 | blocker | Л* | B2 cs (:25-47) исправный аналог; окно между ChargeAsync и InsertOne реально, но ключ его принимает; ? |
| 4 | Payments/CapturePaymentConsumer.cs:33 | major | Н | после списания исчерпание ретраев -> Fault -> Failed без возврата: верно, узкий случай |
| 5 | Payments/CapturePaymentConsumer.cs:29 | major | Н | Discount не проверяется: верно |
| 6 | Payments/SubmitOrderEndpoint.cs:37 | major | Н | клиентские цена/скидка без проверки, код подтверждает; вне предмета скиллов |
| 7 | Payments/OrderSubmittedRelay.cs:25 | major | Л* | B4 cs: флаг SubmitPending + ретранслятор, дубли гасит Ignore(OrderSubmitted) в сагe; решение принято ключом |
| 8 | Payments/OrderFulfilmentStateMachine.cs:57 | major | Л* | Failed без финализации: B9 cs (:64-66) исправный аналог |
| 9 | Payments/PaymentsServiceCollectionExtensions.cs:25 | major | Н | RabbitMQ без учётных данных в FulfilOptions, guest только с loopback: верно, вне ключа |
| 10 | Payments/WarehouseInboundConsumer.cs:74 | major | Л* | маркер до $inc с откатом в catch - B2 cs (:74-85) |
| 11 | Payments/WarehouseInboundConsumer.cs:54 | major | Л* | B1 cs (:49,:54,:57): Nack requeue:false допустим по ключу; отсутствие DLX реально, но ключ принимает |
| 12 | Payments/WarehouseInboundConsumer.cs:89 | major | Л* | обмен warehouse.outbound не объявлен: верно по коду, но код тот же, что у исправного аналога (:90); ? |
| 13 | Caching/StockRecalculatorJob.cs:34 | major | Н | фильтр по полю sku, stock_movements никто не заполняет, Set(stock) затирает $inc склада: верно в собранной ветке |
| 14 | Caching/ApiKeyRateLimiter.cs:20 | major | Н | любой непустой ключ принимается: верно по коду, реестра ключей нет; спорная серьёзность |
| 15 | Program.cs:20 | major | Н | то же: лимитер на /api, маршрутов нет |
| 16 | Caching/PriceEndpoints.cs:12 | major | Н | /internal/price-changed без аутентификации: верно; вне предмета |
| 17 | Search/SearchEndpoints.cs:52 | major | Н | /internal/* без аутентификации: верно по коду; вне предмета скиллов (стенд без аутентификации, ADR аутентификацию не требует) |
| 18 | Caching/MailJobQueue.cs:53 | major | Н | цикл воркера без try / отравленное задание перезабирается вечно: верно |
| 19 | Archive/OrderDoc.cs:9 | major | Н | коллекция orders с несовместимыми схемами _id (Guid и string): верно в собранной ветке |
| 20 | Archive/ShippedWatcher.cs:44 | major | Н | фильтр mailed==false не матчит документы без поля (Kafka/submit): верно в собранной ветке |
| 21 | Archive/ShippedWatcher.cs:31 | major | Л* | щель CatchUp/Watch - M9 cs (:50-63) исправный аналог; щель реальна, но узкая и ключом принята |
| 22 | Archive/OrderStore.cs:28 | major | Н | ReplaceOne целиком, Mailed=false; (f1: схема _id Guid vs string в одной коллекции - верно)  |
| 23 | Kafka/OrderPlacedConsumer.cs:101 | major | Л* | приманка Kafka P1 (:101, ReplaceOne upsert; ключ: идемпотентна по _id) |
| 24 | Kafka/OrderPlacedConsumer.cs:104 | major | Л* | маркер processed до $inc - исправный аналог K7 (:104-120, с откатом в catch); остаточное окно при крэше реально, но ключ его принимает |
| 25 | Kafka/OrderImportConsumer.cs:62 | major | Н | Seek назад без лимита: допустим K9, но null Value (ArgumentNullException, не JsonException) даёт бесконечный повтор: верно, узко |
| 26 | Search/ReindexService.cs:14 | major | Л* | потеря записей при reindex - принятое ограничение E9 cs (alias, атомарный swap) |

Итого n-rv-c4: blocker+major 26, Н 14, Л 0, Л* 12; из них blocker: Н 0, Л 0, Л* 3.

### 3.3 Сводка по N-RV

| прогон | blocker+major всего | Н | Л | Л* | ложных (Л+Л*) | из них blocker |
|---|---|---|---|---|---|---|
| n-rv-f1 | 18 | 10 | 0 | 8 | 8 | 2 |
| n-rv-f2 | 17 | 10 | 0 | 7 | 7 | 0 |
| n-rv-c1 | 21 | 12 | 1 | 8 | 9 | 1 |
| n-rv-c2 | 22 | 11 | 1 | 10 | 11 | 3 |
| n-rv-c3 | 18 | 11 | 1 | 6 | 7 | 2 |
| n-rv-c4 | 26 | 14 | 0 | 12 | 12 | 3 |

Верный исход по ключу - ни одной blocker/major по предмету скиллов: не достигнут ни одним прогоном (ни f, ни c). Спорные: основания помечены ? в таблице P и у отдельных строк (B2/Capture :30, обмен warehouse.outbound :89).
