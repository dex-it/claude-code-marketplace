# Судья прогонов r: mongodb (G-M, RV-M), elasticsearch (G-E, RV-E)

Пути прогонов: wt/tests/trap-skills/<скилл>/runs/<кейс>-r1|r2. Строки DIFF.patch - номера строк файла DIFF.patch прогона.

## G-M (feature/order-history)

| ед. | r1 | r2 | основание |
|---|---|---|---|
| M1 | 1 | 1 | r1 DIFF:61,200 (singleton MongoContext, один MongoClient); r2 DIFF:59,183 |
| M2 | 1 | 1 | r1 DIFF:124-138,203 (order_events); r2 DIFF:121-138,186 |
| M3 | 1 | 1 | r1 DIFF:98-99 (в заказе только CustomerId); r2 DIFF:99-100,107 |
| M4 | 1 | 1 | r1 DIFF:114-115 (встроенный ShippingAddress); r2 DIFF:115-116 |
| M5 | 1 | 1 | r1 DIFF:220-225; r2 DIFF:202-205 |
| M6 | 1 | 1 | равенства CustomerId, Status, затем PlacedAt: r1 DIFF:221-224; r2 DIFF:203-204 |
| M7 | 1 | 1 | TTL ExpireAfter 30 суток по UpdatedAt: r1 DIFF:235-237; r2 DIFF:211-213 |
| M8 | 1 | 1 | проекция Id+Status: r1 DIFF:273-280; r2 DIFF:249-258 |
| M9 | 1 | 1 | WatchAsync с $match по Shipped, compose с replSet: r1 DIFF:10,347-358; r2 DIFF:10,334-344 |
| M10 | 1 | 1 | [BsonIgnoreExtraElements] на всех документах: r1 DIFF:100,125,141,151,166,177; r2 DIFF:82,91,101,122,140,152 |
| M11 | 1 | 1 | replSet в compose + транзакция: r1 DIFF:10,414-415; r2 DIFF:10,396-397 (директ-коннект, ограничение названо в комментарии) |

## RV-M (order-archive)

| ед. | r1 | r2 | основание |
|---|---|---|---|
| M1 | 1 | 1 | r1 REVIEW:5 (OrderStore.cs:18, blocker); r2 REVIEW:1 (:17-18) |
| M2 | 1 | 1 | r1 REVIEW:10 (OrderEvents.cs:17, 16 МБ); r2 REVIEW:12 (OrderEvents.cs:11-21) |
| M3 | 1 | 1 | r1 REVIEW:1 (OrderDoc.cs:23, устаревший email); r2 REVIEW:2 (OrderStore.cs:27-28) |
| M4 | ? | 0 | r1 REVIEW:15 (OrderStore.cs:35, minor): "заказ и адрес двумя операциями, заказ без адреса" - последствие из ключа названо, но корень (адрес в отдельной коллекции, второй запрос на чтение, встроить) не назван, место :35 - запись, ключ :38-39,48. r2: про адрес нет ничего |
| M5 | 1 | 1 | r1 REVIEW:7 (ArchiveInitializer.cs:12); r2 REVIEW:6 (:10-19) |
| M6 | 1 | 1 | r1 REVIEW:12 (ArchiveInitializer.cs:18, minor - засчитано, severity не требуется); r2 REVIEW:13 (:18) |
| M7 | 1 | 1 | r1 REVIEW:11 (CartDraftCleaner.cs:13, "лучше TTL-индекс", нагрузка/скан); r2 REVIEW:15 (:9-16, minor, TTL) |
| M8 | 1 | 1 | r1 REVIEW:2 (OrderStore.cs:70); r2 REVIEW:4 (:61-69) |
| M9 | 1 | 1 | r1 REVIEW:3 (ShippedWatcher.cs:31); r2 REVIEW:5 (:31-41) |
| M10 | 1 | 1 | r1 REVIEW:4 (MongoConventions.cs:18, FormatException); r2 REVIEW:3 (:18-20) |
| M11 | 0 | 0 | в обоих REVIEW нет находки про StartSession/WithTransactionAsync на standalone mongod (StockTransfer.cs:36-37); r2 REVIEW:16 касается только ключа склада |
| P1 | 0 | 0 | ExportAsync (OrderStore.cs:73) - major в обоих: r1 REVIEW:9, r2 REVIEW:9. ? : находка о "без лимита/курсора, OOM", а не о проекции; но просит правки по приманке со severity major - строго 0 |
| P2 | 1 | 1 | r1 REVIEW:14 Tags (OrderStore.cs:33) только minor; r2 не заявлено |
| O1 | 1 | 1 | double в деньгах: r1 REVIEW:8 (OrderStore.cs:31); r2 REVIEW:10 (:31), :11 |
| O2 | 1 | 1 | Skip(page*PageSize): r1 REVIEW:6 (OrderStore.cs:57); r2 REVIEW:8 (:57) |

## G-E (feature/product-search)

| ед. | r1 | r2 | основание |
|---|---|---|---|
| E1 | 1 | 1 | явный strict-маппинг: r1 DIFF:90-118 (создание через PUT с IndexDefinition, :135); r2 DIFF:362-393 (IndexDefinition.Create, DIFF:75) |
| E2 | 1 | 1 | multi_match по text, term по keyword category: r1 DIFF:357-362,397; r2 DIFF:297-303,221 |
| E3 | 1 | 1 | подполе name.raw (keyword) и сортировка по нему: r1 DIFF:106,347; r2 DIFF:380,312 |
| E4 | 1 | 1 | PIT + search_after: r1 DIFF:404-437; r2 DIFF:234-269 |
| E5 | 1 | 1 | terms по keyword category: r1 DIFF:394,113; r2 DIFF:215,387 |
| E6 | 1 | 1 | multi_match с явными полями и весом name^3: r1 DIFF:361; r2 DIFF:302 |
| E7 | 1 | 1 | _bulk пачками: r1 DIFF:163-190 (5000); r2 DIFF:96-143 (2000) |
| E8 | 1 | 1 | разбор errors, исключение/повтор: r1 DIFF:215-217; r2 DIFF:150-151,153-157 |
| E9 | 1 | 1 | чтение через alias products, атомарный _aliases remove+add: r1 DIFF:224-237,399; r2 DIFF:161-168,223 |
| E10 | 1 | 1 | reindex не используется; пересборка из источника Bulk в 4 параллельных потока (допустимо по ключу): r1 DIFF:165-172; r2 DIFF:98-110 |
| E11 | 1 | 1 | russian + подполе en (english): r1 DIFF:103-111; r2 DIFF:377-386 |

## RV-E (catalog-search)

Замечание: r2 в REVIEW даёт номера строк со сдвигом 2-3 (напр. агрегация :46 вместо :48, сортировка :51 вместо :54, :39 вместо :41), содержимое указывает на ту же конструкцию; места засчитаны.

| ед. | r1 | r2 | основание |
|---|---|---|---|
| E1 | 1 | 1 | r1 REVIEW:1 (ReindexService.cs:12, blocker); r2 REVIEW:2 (:12) |
| E2 | 1 | 1 | r1 REVIEW:14 (ProductSearch.cs:74); r2 REVIEW:13 (:72) |
| E3 | 1 | 1 | r1 REVIEW:13 (ProductSearch.cs:54); r2 REVIEW:10 (:51) |
| E4 | 1 | 1 | r1 REVIEW:15 (ProductExport.cs:20); r2 REVIEW:14 (:18) |
| E5 | 1 | 1 | r1 REVIEW:12 (ProductSearch.cs:48); r2 REVIEW:8 (:46) |
| E6 | 1 | 1 | r1 REVIEW:10 (ProductSearch.cs:25); r2 REVIEW:11 (:25) |
| E7 | 1 | 1 | r1 REVIEW:6 (ProductIndexer.cs:41); r2 REVIEW:6 (:39) |
| E8 | 1 | 1 | r1 REVIEW:7 (ProductIndexer.cs:50); r2 REVIEW:7 (:48) |
| E9 | 1 | 1 | r1 REVIEW:3,4 (ReindexService.cs:23, ProductIndexer.cs:10); r2 REVIEW:3,4 |
| E10 | 1 | 1 | r1 REVIEW:2 (ReindexService.cs:15, slices); r2 REVIEW:1 (:15) |
| E11 | 1 | 1 | r1 REVIEW:5 (ProductIndexer.cs:28, морфология); r2 REVIEW:5 (:26) |
| P1 | 1 | 1 | StatsAggregation price (ProductSearch.cs:49) не заявлена ни в r1, ни в r2 |
| P2 | 1 | 1 | From/Size с MaxPage не заявлены как дефект глубины (r1 :45 и r2 :43 - про O2, смещение страницы) |
| O1 | 1 | 1 | r1 REVIEW:9 (ProductSearch.cs:24, major); r2 REVIEW:12 (:24) |
| O2 | 1 | 1 | r1 REVIEW:11 (ProductSearch.cs:45, blocker); r2 REVIEW:9 (:43) |

## Итог по единицам (по кейсам с клеткой)

- G-M: M1-M11 все 2/2.
- RV-M: M1-M3, M5-M10 2/2; M4 1/2 или 0/2 (r1 спорная); M11 0/2; P1 0/2 (провал обоих); P2 2/2; O1 2/2; O2 2/2.
- G-E: E1-E11 все 2/2.
- RV-E: E1-E11, P1, P2, O1, O2 все 2/2.
- Сводно по единице (G + RV): M4 2/4 при r1=1, 1/4 при r1=0 (?), M11 2/4 (код 2/2, ревью 0/2), P1 (RV-M) 0/2.

## Спорные клетки

- RV-M M4 r1: "?" (причина выше); если оператор решит строго - 0.
- RV-M P1 обоих: строго 0 (major по приманке); оговорка - формулировка находки "нет лимита", не "нет проекции".

## Н (сверх ключа, кратко, без вердикта)

- RV-M r1: CartDraftCleaner.cs:13 необработанное исключение DeleteMany останавливает BackgroundService/хост; ShippedWatcher.cs:47 флаг Mailed до отправки, потеря письма при падении.
- RV-M r2: OrderStore.cs:52-59 SearchAsync без проекции; ShippedWatcher.cs:57-61 сбой IMailer прерывает цикл по пачке.
- RV-E r1/r2: SearchEndpoints.cs:52 /internal/* без авторизации; SearchEndpoints.cs:17 IndexBootstrap глотает ошибку (минор); r1: ProductSearch.cs:25 QueryString допускает wildcard/regexp (нагрузка); r2 ProductExport.cs:20 sku-сортировка без tiebreaker/PIT.
- Прочее: цена `double` в ES-маппинге (оба RV-E, minor) - сверх ключа.
- G-M r1/r2: IMailer объявлен самим исполнителем в Ports.cs (оговорено в ANSWER); r2 Program.cs `var app =builder.Build()` (стиль, не оценивается).
