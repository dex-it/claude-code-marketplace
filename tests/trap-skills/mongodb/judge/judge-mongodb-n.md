# Судья mongodb, набор n (c1 = n1, c2 = n2)

## g-m (код, DIFF.patch)
| единица | n1 | n2 | основание |
|---|---|---|---|
| M1 | 1 | 1 | n1: MongoContext.cs:17 `new MongoClient` в singleton; n2: Program.cs `AddSingleton<IMongoClient>` |
| M2 | 1 | 1 | n1: Documents.cs OrderEventDocument + MongoOrderStore.AddEventAsync (order_events, OrderId); n2: Documents.cs OrderEventDocument, OrderStore.cs AddEventAsync/GetEventsAsync |
| M3 | 1 | 1 | оба: в OrderDocument только CustomerId (n1 Order.cs комментарий, n2 Documents.cs:12-13) |
| M4 | 1 | 1 | n1: OrderDocument.ShippingAddress (AddressDocument); n2: OrderDocument.Address, вложен |
| M5 | 1 | 1 | n1: MongoContext.cs EnsureIndexesAsync customer_status_placed; n2: OrderStore.cs EnsureIndexesAsync |
| M6 | 1 | 1 | оба: CustomerId, Status, затем PlacedAt desc |
| M7 | 1 | 1 | оба: TTL ExpireAfter 30 суток по UpdatedAt (n1 MongoContext.cs ttl_updated; n2 MongoSetup.cs) |
| M8 | 1 | 1 | n1: MongoOrderStore.ListSummariesAsync Project Include(Id, Status); n2: OrderStore.GetMyOrdersAsync Project(OrderSummary) |
| M9 | 1 | 1? | n1: ShippedMailWorker.cs WatchAsync с $match по Status==Shipped, без опроса (аренда MailClaimedAt - не таймерный опрос, захват по событию). n2: ShippedWatcher.cs WatchAsync с фильтром; ? - регистрация `AddHostedService<ShippedWatcher>` закомментирована в Program.cs (нет IMailer), код реакции есть, но в процессе не запущен |
| M10 | 1 | 1 | n1: [BsonIgnoreExtraElements] на всех документах (Documents.cs); n2: MongoSetup.cs RegisterConventions IgnoreExtraElementsConvention, вызван первой строкой Program.cs |
| M11 | 1 | 1 | оба: replica set в compose (--replSet, healthcheck rs.initiate) + WithTransactionAsync (n1 MongoStockTransfer.cs; n2 StockTransfer.cs) |

## rv-m (ревью, REVIEW.md)
| единица | n1 | n2 | основание |
|---|---|---|---|
| M1 | 1 | 1 | оба OrderStore.cs:18, blocker, исчерпание соединений |
| M2 | 1 | 1 | оба OrderEvents.cs:14/19, рост до 16 МБ |
| M3 | 1 | 1 | оба OrderDoc.cs:23, устаревший email |
| M4 | 1 | 1 | оба OrderStore.cs:35/38, два чтения и заказ без адреса (minor, последствие названо) |
| M5 | 1 | 1 | n1 ArchiveInitializer.cs:10; n2 OrderStore.cs:55 + ArchiveInitializer: COLLSCAN |
| M6 | 1 | 1 | оба ArchiveInitializer.cs:18, порядок At/ToWarehouse/Sku |
| M7 | 1 | 1 | оба CartDraftCleaner.cs:13/9, предложен TTL, нагрузка/скан |
| M8 | 1 | 1 | оба OrderStore.cs:61/63, нет проекции |
| M9 | 1 | 1 | оба ShippedWatcher.cs:31, опрос 5 с вместо change stream |
| M10 | 1 | 1 | n1 OrderDoc.cs:19 (+MongoConventions.cs:16); n2 MongoConventions.cs:16, FormatException |
| M11 | 1 | 0? | n1 StockTransfer.cs:37 blocker, падение на standalone. n2 StockTransfer.cs:44 только minor и «в docker compose проверить»: падение не названо, место сдвинуто с :36-37 - ? |
| P1 | 0? | 0? | оба OrderStore.cs:73 major (OOM без лимита/курсора). Просят major по приманке, хотя про проекцию не говорят - ? (строго по ключу: major на строке приманки = 0) |
| P2 | 1 | 1 | n1 не заявлена; n2 OrderStore.cs:33 minor |
| O1 | 1 | 1 | n1 OrderStore.cs:31, OrderDoc.cs:27; n2 OrderStore.cs:31 (double, округление) |
| O2 | 1 | 0? | n1 OrderStore.cs:57 «при page=1 теряется первая страница»; n2 :66/:57 говорит о путанице нумерации и отрицательном Skip при page=0, но ошибку page*PageSize (пропуск первой страницы) не называет - ? |

## Итог по единицам
- g-m: M1-M8, M10, M11 - 2/2; M9 - 2/2 (? n2: хостед-сервис закомментирован).
- rv-m: M1-M10 - 2/2; M11 - 1/2 (?); P1 - 0/2 (?); P2 - 2/2; O1 - 2/2; O2 - 1/2 (?).

## Н (сверх ключа, без вердикта)
- n1: ShippedWatcher.cs:47 Mailed=true до отправки, потеря письма при падении; :57 ошибка одного письма блокирует хвост; CartDraftCleaner.cs:13 исключение валит хост.
- n2: OrderStore.cs:35 ReplaceOne в ArchiveAsync сбрасывает Events и Mailed (повторное письмо); ShippedWatcher.cs:59 то же про потерю письма и ядовитый заказ; CartDraftCleaner.cs:13 исключение валит хост.
- g-m n2: письмо уходит на каждое изменение заказа в Shipped (дубли), сам автор отметил в ANSWER.md; n1 защищает захватом MailClaimedAt/MailSentAt.
