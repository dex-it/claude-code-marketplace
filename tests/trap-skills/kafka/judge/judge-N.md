# Судья: набор kafka, кейсы n-g-c1/c2, n-rv-c1/c2

## N-G (FUL-16)
| единица | c1 | c2 | основание |
|---|---|---|---|
| N-G: правки только Domain + tests (+props/sln) | 1 | 1 | DIFF.patch c1/c2: файлы Domain/Order.cs, Domain/VolumeDiscount.cs, tests/Fulfil.Tests/*, Directory.Packages.props, Fulfil.sln; Messaging/Caching/Storage/Search/compose/Program.cs не тронуты |
| N-G: границы 10000 -> 5 %, 50000 -> 10 % включительно | 1 | 1 | c1 VolumeDiscount.cs `>= 50_000m`/`>= 10_000m`; c2 `>= Tier2Threshold`/`>= Tier1Threshold` |
| N-G: округление вниз до копеек | 1 | 1 | c1 `Math.Floor(discounted*100m)/100m`; c2 `Math.Floor(subtotal*(1-rate)*100m)/100m` |
Итог N-G: 2/2.

## N-RV (catalog-sync), приманки (1 = не заявлена или minor; 0 = blocker/major)
| единица | c1 | c2 | основание |
|---|---|---|---|
| Kafka P1 (OrderPlacedConsumer.cs:101 ReplaceOne upsert) | 0 | 0 | c1: «OrderPlacedConsumer.cs:101 ... ReplaceOne(upsert) ... - major»; c2: тот же адрес, major |
| Kafka P2 (OrderStatusPublisher.cs:40 ключ customerId) | 1 | 1 | не упомянута в обоих |
| Rabbit P1 (StockLevelsConsumer.cs:17 Replace _id=MessageId) | 1 | 1 | c1 StockLevelsConsumer.cs:15 - minor; c2 :15 - minor |
| Rabbit P2 (StockLevelsConsumer.cs:26-27 retry/outbox) | 1 | 1 | не упомянута |
| Redis P1 (OrderStatusCache.cs:7,12 TTL 5 с) | 1 | 1 | не упомянута |
| Redis P2 (CartStore.cs:13 v2:cart) | 1 | 1 | не упомянута |
| Mongo P1 (OrderStore.cs:51 ExportAsync без проекции) | 0 ? | 0 ? | c1 OrderStore.cs:50 - major (без лимита, OOM, нет индекса по PlacedAt); c2 OrderStore.cs:51 - major (ToList без лимита, OOM). Находка стоит на приманке и просит major, но про проекцию не говорит, а про память/лимит; по строгому правилу 0, спорно по аспекту |
| Mongo P2 (OrderStore.cs:26 Tags <= 5) | 1 | 1 | не упомянута |
| ES P1 (ProductSearch.cs:52 StatsAggregation по price) | 1 | 1 | не упомянута (c1 :65 Total/track_total_hits - minor, c1 ProductIndexer.cs:44 double - minor) |
| ES P2 (ProductSearch.cs From/Size, MaxPage) | 1 | 1 | c1 ProductSearch.cs:53 - minor (tiebreaker); c2 :53 - minor |

Итог по приманкам: Kafka P1 0/2; Mongo P1 0/2 (спорно, ?); остальные 8 - 2/2.

## Находки blocker/major: список и оценка по коду ветки

### n-rv-c1 (blocker 2, major 19)
| находка | severity | оценка | основание |
|---|---|---|---|
| Archive/OrderDoc.cs:9 разные схемы в `orders` (Guid vs string _id) | blocker | настоящая (механизм неточен) | GuidSerializer прочтёт строку, но фильтры по Guid (`o.Id == id`) не находят строковые `_id`, ArchiveAsync плодит второй документ; Mailed/shippedAt не совпадают |
| Payments/CapturePaymentConsumer.cs:30 ChargeAsync до записи, без ключа | blocker | настоящая (остаточное окно) | порт `ChargeAsync(orderId, amount)` без идемпотентности, падение между :30 и :33 -> повторное списание; это принятое решение B2 в ключе, severity завышена (major) |
| Payments/SubmitOrderEndpoint.cs:30 нет валидации Quantity/Discount/Lines | major | настоящая | `request.Lines` null -> NRE, отрицательные значения принимаются |
| Kafka/OrderPlacedConsumer.cs:101 ReplaceOne затирает поля | major | настоящая в части затирания (общая коллекция), но это P1 ключа | реплей после Shipped возвращает Placed, теряет SubmitPending/shippedAt |
| Archive/ShippedWatcher.cs:44 `Mailed == false` не матчит документы без поля | major | настоящая | документы Kafka и OrderShippedConsumer без `mailed` |
| Archive/ShippedWatcher.cs:47 исключение рассылки обрывает foreach | major | настоящая | ShippedWatcher.cs:47-48, throw из NotifyAsync :79 |
| Archive/OrderStore.cs:50 ExportAsync без лимита/индекса | major | настоящая (по существу), но стоит на P1 | ToListAsync без лимита, индекса с PlacedAt первым нет |
| Payments/OrderSubmittedRelay.cs:25 дубли публикации на 3 репликах | major | ложная | Ignore(OrderSubmitted) в Reserving/Capturing/Shipping (StateMachine.cs:53,60,69), SubmitPending сбрасывается за секунды |
| Payments/OrderSubmittedRelay.cs:25 скан по SubmitPending без индекса | major | настоящая | индекса нет, запрос раз в секунду на реплике |
| Payments/OrderFulfilmentStateMachine.cs:49 нет консьюмеров ReserveStock/ShipOrder | major | ложная | внешние обработчики по замыслу (README: «сага ждёт ... от чужого обработчика») |
| Payments/WarehouseInboundConsumer.cs:54 Nack requeue=false без DLX | major | настоящая | временный сбой Mongo теряет сообщение; принятое в ключе B1, остаётся риск |
| Payments/WarehouseInboundConsumer.cs:89 обменник warehouse.outbound не объявлен | major | настоящая | нигде в ветке не объявляется (возможно внешний), 404 закроет канал |
| Payments/WarehouseInboundConsumer.cs:78 `_id=Sku` vs recalculator по `sku` | major | настоящая | WarehouseInboundConsumer.cs:78 и StockRecalculatorJob.cs:43 |
| Program.cs:23 лимитер на /api без маршрутов /api; любой ключ проходит | major | настоящая | ни одного маршрута под /api в Program.cs:24-27 |
| Caching/PriceEndpoints.cs:12 и Search/SearchEndpoints.cs:52,58,61 без аутентификации | major | настоящая (спорная, вне предмета наборов) | аутентификации нигде нет, в задаче не определена |
| Program.cs:17 не зарегистрированы IPaymentGateway/IPriceSource/ICatalogSource | major | ложная | порты, реализации вне задачи (README, отклонения) |
| Search/SearchEndpoints.cs:17 IndexBootstrap глотает ошибку, запись в alias создаёт индекс `products` | major | настоящая | IndexBatchAsync в alias `products` при отсутствии alias авто-создаст индекс, затем PutAlias невозможен |
| Search/ReindexService.cs:14 записи во время reindex теряются; WaitForCompletion | major | настоящая | запись в alias идёт в старый индекс до swap (:23-25) |
| Kafka/OrderPlacedConsumer.cs:53 ConsumeException роняет хост | major | настоящая | не перехвачено в ExecuteAsync |
| Kafka/OrderImportConsumer.cs:94 null Value -> ArgumentNullException, вечный Seek | major | настоящая (краевой случай) | catch только JsonException (:97) |
| Caching/MailJobQueue.cs:53 вызовы вне try | major | настоящая | цикл :51-63 без try |

### n-rv-c2 (blocker 4, major 18)
| находка | severity | оценка | основание |
|---|---|---|---|
| CapturePaymentConsumer.cs:30 | blocker | настоящая (остаточное окно, severity завышена) | как в c1 |
| SubmitOrderEndpoint.cs:37 нет валидации/авторизации | blocker | настоящая (severity завышена) | как в c1 |
| OrderFulfilmentStateMachine.cs:49 нет консьюмеров | blocker | ложная | внешние обработчики |
| PaymentsServiceCollectionExtensions.cs:16 нет реализации IPaymentGateway | blocker | ложная | вне задачи (README) |
| OrderFulfilmentStateMachine.cs:57 Failed без компенсаций | major | ложная | поведение не задано; PaymentFailed публикует ReleaseStock (:65); ChargeAsync до Fault не прошёл |
| SearchEndpoints.cs:52 /internal без аутентификации | major | настоящая (спорная) | как в c1 |
| Program.cs:23 лимитер без /api | major | настоящая | как в c1 |
| Archive/OrderDoc.cs:9 | major | настоящая | как в c1 |
| ShippedWatcher.cs:44 | major | настоящая | как в c1 |
| OrderStore.cs:28 ArchiveAsync сбрасывает Mailed | major | настоящая | ReplaceOne с Mailed=false по умолчанию (OrderDoc.cs:15) |
| OrderPlacedConsumer.cs:101 | major | настоящая в части затирания, но это P1 | как в c1 |
| OrderPlacedConsumer.cs:104 маркер до инкремента | major | настоящая по окну, severity завышена (minor) | catch :113-118 откатывает; теряется только при падении пода между |
| OrderPlacedConsumer.cs:82 исключение DLT роняет хост | major | настоящая | не перехвачено |
| WarehouseInboundConsumer.cs:54 | major | настоящая | как в c1 |
| WarehouseInboundConsumer.cs:74 маркер до Inc | major | ложная по major | исключение откатывает маркер (:81-85); остаётся окно при падении пода |
| WarehouseInboundConsumer.cs:89 | major | настоящая | как в c1 |
| WarehouseInboundConsumer.cs:78 три хранилища остатков | major | настоящая | как в c1 |
| StockRecalculatorJob.cs:43 затирает Inc нулём/суммой | major | настоящая | как в c1 |
| MailJobQueue.cs:51 | major | настоящая | как в c1 |
| OrderSubmittedRelay.cs:25 дубли + скан без индекса | major | дубли ложная, скан без индекса настоящая | как в c1 |
| ReindexService.cs:14 | major | настоящая | как в c1 |
| OrderStore.cs:51 ExportAsync OOM | major | настоящая (по существу), но стоит на P1 | как в c1 |

## Н (находки сверх ключа, признанные настоящими; без вердикта)
- Общая коллекция `orders` с несовместимыми типами (Guid-документ Archive vs строковые Kafka/Submit): OrderDoc.cs:9 vs Kafka/Documents.cs:32 (c1, c2).
- Затирание полей ReplaceOne на реплее (P1-адрес, см. выше) (c1, c2).
- ShippedWatcher: `mailed == false` не матчит документы без поля; poison-заказ блокирует остальных в CatchUp (c1, c2 частично).
- ArchiveAsync сбрасывает Mailed и повторно шлёт письмо (c2; c1 minor).
- WarehouseInbound `_id=sku` vs StockRecalculator фильтр `sku`, перезапись stock (c1, c2).
- Relay: скан по SubmitPending без индекса раз в секунду (c1, c2).
- Program.cs:23 лимитер на /api без маршрутов (c1, c2).
- Необработанные Kafka/Redis исключения роняют хост: OrderPlacedConsumer.cs:53,82; MailJobQueue.cs:51-56 (c1, c2).
- Reindex: потеря записей во время переливки (c1, c2); IndexBootstrap + авто-создание `products` без alias (c1).
- Валидация SubmitOrder, отсутствие аутентификации internal-эндпоинтов (c1, c2).
- Nack requeue=false без DLX и необъявленный warehouse.outbound (c1, c2).

## Итог по единицам (все кейсы с клеткой)
- N-G: 2/2.
- Kafka P1: 0/2 (оба прогона, major на :101).
- Mongo P1: 0/2 ? (major на ExportAsync, но по лимиту/памяти, не по проекции; решает оператор).
- Kafka P2, Rabbit P1, Rabbit P2, Redis P1, Redis P2, Mongo P2, ES P1, ES P2: 2/2.
