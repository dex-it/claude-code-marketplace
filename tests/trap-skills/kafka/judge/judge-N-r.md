# Судья: набор r (n-rv-r1, n-rv-r2), находки blocker/major по коду ветки catalog-sync

Метод как в judge-N.md. Ветка: <scratch> Оценки пунктов, совпадающих с judge-N.md, перенесены оттуда.

### n-rv-r1 (blocker 4, major 11; всего 15)
| находка | severity | оценка | основание |
|---|---|---|---|
| Archive/OrderDoc.cs:9 разные схемы в `orders` | blocker | настоящая (механизм неточен) | GuidSerializer читает строковый _id, «падает на десериализации» неверно; но фильтры по Guid не находят строковые документы, плодятся дубли (как в judge-N c1) |
| Kafka/OrderPlacedConsumer.cs:101 ReplaceOne откатывает в Placed | blocker | настоящая (severity завышена; это P1 ключа) | ReplaceOne upsert целым документом, затирает shippedAt/mailed |
| Archive/ShippedWatcher.cs:44 `mailed == false` не матчит без поля | major | настоящая | как в judge-N |
| Kafka/OrderImportConsumer.cs:62 вечный Seek при сбое пачки | blocker | настоящая (краевой случай, severity завышена) | catch :62 без лимита; JsonException ловится внутри, но null Value (tombstone) даёт ArgumentNullException -> бесконечный повтор |
| Kafka/OrderImportConsumer.cs:97 нечитаемое сообщение пропускается без DLT | major | настоящая | :97-100 только warning с offset, тело теряется, смещение коммитится |
| Kafka/OrderPlacedConsumer.cs:82 DLT-отправка не защищена | major | настоящая | как в judge-N |
| Payments/CapturePaymentConsumer.cs:30 ChargeAsync без ключа | blocker | настоящая (остаточное окно, severity завышена) | как в judge-N; retry включён (PaymentsServiceCollectionExtensions.cs:26) |
| Payments/OrderFulfilmentStateMachine.cs:68 Shipping без отката | major | ложная | сбой ShipOrder в чужом обработчике, поведение не задано; аналог «Failed без компенсаций» в judge-N c2 признан ложным |
| Payments/WarehouseInboundConsumer.cs:54 Nack requeue=false без DLX | major | настоящая | как в judge-N |
| Payments/WarehouseInboundConsumer.cs:78 `_id=sku` vs recalculator | major | настоящая | как в judge-N |
| Program.cs:22 лимитер на /api без маршрутов + /internal без аутентификации | major | настоящая | как в judge-N |
| Caching/MailJobQueue.cs:53 цикл без try | major | настоящая | как в judge-N |
| Archive/OrderStore.cs:51 ExportAsync без лимита | major | настоящая (по существу, стоит на Mongo P1) | как в judge-N |
| Search/ReindexService.cs:18 WaitForCompletion + потеря записей | major | настоящая | как в judge-N |
| Search/ProductIndexer.cs:53 IndexAllAsync последовательно, «наполовину пустой индекс» | major | ложная | пишется upsert по Id=Sku в живой алиас (:71), существующие документы не пропадают; пачки по 1000 - штатный bulk; требований к скорости нет |

Итог r1: 15 blocker/major, ложных 2, настоящих 13.

### n-rv-r2 (blocker 2, major 17; всего 19)
| находка | severity | оценка | основание |
|---|---|---|---|
| Archive/ShippedWatcher.cs:44 FormatException при чтении строковых _id как Guid | blocker | ложная (в части заявленного механизма) | GuidSerializer(Standard) принимает строку, исключения нет; реальный дефект ShippedWatcher - `mailed == false` без поля, заявлен не он |
| Payments/CapturePaymentConsumer.cs:30 | blocker | настоящая (severity завышена) | как в judge-N |
| Archive/OrderDoc.cs:9 три схемы в `orders` | major | настоящая | как в judge-N |
| Kafka/OrderPlacedConsumer.cs:101 | major | настоящая (P1) | как в judge-N |
| Kafka/OrderImportConsumer.cs:97 | major | настоящая | как r1 |
| Kafka/OrderImportConsumer.cs:62 | major | настоящая (краевой случай) | как r1 |
| Payments/SubmitOrderEndpoint.cs:37 нет проверки UnitPrice/Discount | major | настоящая | отрицательные значения принимаются, `request.Lines` null -> NRE (:30) |
| Payments/OrderFulfilmentStateMachine.cs:68 Shipping без отката, Refund не вызывается | major | ложная | как r1: поведение не задано, внешние обработчики |
| Payments/PaymentsServiceCollectionExtensions.cs:19 нет outbox | major | настоящая (спорная, общий риск) | UseMongoDbOutbox/bus outbox нет; окно между сохранением саги и публикацией реально, но не специфично для ветки |
| Payments/OrderSubmittedRelay.cs:25 скан без индекса | major | настоящая | как в judge-N |
| Payments/WarehouseInboundConsumer.cs:54 | major | настоящая | как в judge-N |
| Program.cs:16 не зарегистрированы IPaymentGateway/IPriceSource/ICatalogSource | major | ложная | порты, реализации вне задачи (как в judge-N c1/c2) |
| Program.cs:23 лимитер без /api | major | настоящая | как в judge-N |
| Caching/MailJobQueue.cs:45 | major | настоящая | как в judge-N |
| Caching/StockRecalculatorJob.cs:43 | major | настоящая | как в judge-N |
| Search/SearchEndpoints.cs:52 /internal без аутентификации | major | настоящая (спорная) | как в judge-N |
| Search/ProductIndexer.cs:53 последовательная загрузка, «частичные данные» | major | ложная | upsert в живой алиас, старые документы остаются; см. r1 |
| Search/ReindexService.cs:14 | major | настоящая | как в judge-N |
| Archive/OrderStore.cs:50 ExportAsync | major | настоящая (по существу, Mongo P1) | как в judge-N |

Итог r2: 19 blocker/major, ложных 4, настоящих 15.

## Сравнение
- r1: 15 (ложных 2, настоящих 13); r2: 19 (ложных 4, настоящих 15). Среднее ложных на прогон: 3,0.
- Набор f (judge-N, c1/c2): c1 21 (ложных 3), c2 22 (ложных 4, ещё 1 частично - Relay) - среднее 3,5 (по таблицам judge-N).
