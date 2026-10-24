# Судья r: rabbitmq (G-B, RV-B) и redis (G-C, RV-C), прогоны r1/r2
Пути: <скилл>/runs/<кейс>-r1|r2. Строки кода - DIFF.patch; строки ревью - из самого REVIEW.md (место = файл:строка по ключу).

## G-B (rabbitmq/runs/g-b-r1, g-b-r2)
| ед. | r1 | r2 | основание |
|---|---|---|---|
| B1 | 1? | 1? | r1 DIFF:534 autoAck:false, :571 ack после Mongo, :561/:573 nack requeue:false; r2 DIFF:654 autoAck:false, :698 ack после записи, :676/:684 requeue:false. Оба на транзитной ошибке делают nack requeue:true (r1 :579, r2 :705) - ключ требует «без возврата в ту же очередь»; провал по ключу только autoAck:true, поэтому 1, но «?» |
| B2 | 1 | 0? | r1 :595-619 (_id=messageId, DuplicateKey) и :125-130 (проверка Captured по OrderId). r2: приход - ops-ключ в $inc (StockStore :553-561, вызов Worker :680) ок; платёж - CapturePaymentConsumer :73 `ChargeAsync` безусловно, дедуп только «OrderId как ключ шлюзу», ANSWER сам оговаривает зависимость от шлюза; своей проверки нет. «?»: можно читать как допущение о шлюзе (IPaymentGateway не принимает ключ - сигнатура ChargeAsync(orderId, amount, ct)), строго - 0 |
| B3 | 1 | 1 | r1 :529 BasicQosAsync(…,50); r2 :650 BasicQosAsync(0, 50) |
| B4 | 1 | 1 | r1 Program :870-875 Mongo outbox, заказ+Publish в одной транзакции (компоуз на replica set :10); r2 SubmitOrderEndpoint :439 OutboxPending + OrderOutboxRelay :323-338 |
| B5 | 1 | 1 | r1 :530 durable:true, Relay :436 Persistent; r2 очередь склада не объявляется (чужая), публикация :694 Persistent=true; MassTransit остальное |
| B6 | 1 | 1 | r1 Program :834 Exponential(5); r2 :513 Exponential(5), Fault после исчерпания |
| B7 | 1 | 1 | порядок задан сагой (r1 StateMachine :727-762, r2 :200-233); зависимого от чужого события консьюмера нет (RefundPayment r1 :161 терпит отсутствие платежа). Допустимо и n/a |
| B8 | 1 | 1 | r1 :707-715 CorrelateById на все события; r2 :177-185 |
| B9 | 1 | 1 | r1 :744-762 (ReleaseStock при сбое оплаты, Refund+Release при сбое отгрузки); r2 :206,:219,:223,:231-232 |
| B10 | 1 | 1 | r1 Program :821 MongoDbRepository; r2 Program :501 MongoDbRepository |

Итог G-B: B1 2/2 (?), B2 1/2 (r2 ?), B3-B10 2/2.

## RV-B (rabbitmq/runs/rv-b-r1, rv-b-r2)
| ед. | r1 | r2 | основание |
|---|---|---|---|
| B1 | 1 | 1 | оба WarehouseInboundConsumer.cs:52 autoAck:true, потеря прихода (blocker) |
| B2 | 1 | 1 | оба :69 нет дедупа по MessageId; CapturePaymentConsumer :26 повторное списание (r1 :26 blocker, r2 :26 blocker) |
| B3 | 1 | 1 | r1 :52 «нет BasicQosAsync, весь backlog в память»; r2 :52 то же (рядом с ключом :38-39, тот же метод) |
| B4 | 1 | 1 | оба SubmitOrderEndpoint.cs:42, заказ зависает без процесса (blocker) |
| B5 | 1 | 1 | оба :38 durable:false, потеря очереди при рестарте брокера (Persistent на :74 не назван, ключ :38 есть) |
| B6 | 1 | 1 | оба PaymentsServiceCollectionExtensions.cs:24 Immediate(int.MaxValue), нет _error (major) |
| B7 | 1? | 0 | r1 OrderShippedConsumer.cs:22: бросает при отсутствии платежа, при бесконечном ретрае не завершится - последствие названо, но про «OrderShipped раньше платежа» не сказано; «?». r2 только :24 MatchedCount - не B7 |
| B8 | 1 | 1 | r1 StateMachine :38 (и :34) без CorrelateById, события не коррелируются; r2 :34/:38 то же |
| B9 | 1 | 1 | оба :64 PaymentFailed->Failed без ReleaseStock, резерв навсегда (blocker) |
| B10 | 1 | 1 | оба PaymentsServiceCollectionExtensions.cs:18 InMemoryRepository (blocker) |
| P1 | 1 | 1 | StockLevelsConsumer :15 - r1 и r2 только minor (мнимая идемпотентность / рост коллекции), не blocker/major |
| P2 | 1 | 1 | StockLevelsConsumer :26-27 не заявлена ни там, ни там |
| O1 | 1 | 0 | r1 CapturePaymentConsumer.cs:25 «Discount игнорируется, списывается Total» (major). r2 не называет :25; его замечание про SubmitOrderEndpoint:37 - другое место и другая претензия |
| O2 | 1 | 1 | оба CapturePaymentConsumer.cs:34 e-mail в лог (minor) |

Итог RV-B: B7 1/2 (r1 ?), O1 1/2, остальные 2/2.

## G-C (redis/runs/g-c-r1, g-c-r2)
| ед. | r1 | r2 | основание |
|---|---|---|---|
| C1 | 1 | 1 | r1 RedisServiceCollectionExtensions :618-627 singleton; r2 Program :+ AddSingleton<IConnectionMultiplexer> |
| C2 | 1 | 1 | r1 :621 AbortOnConnectFail=false; r2 Program AbortOnConnectFail=false |
| C3 | 1 | 1 | r1 PriceCache :272, :351-355 (PX, jitter); r2 PriceCache StoreScript PX, ttl 5 мин ±20% |
| C4 | 1 | 1 | r1 PriceCache :304 `_inflight` Lazy single-flight; r2 PriceCache `_inflight` Lazy, то же. Повторной проверки кэша внутри Load нет у обоих, но схлопывание в процессе есть (допустимо по ключу) |
| C5 | 1 | 1 | r1 :316-323 InvalidateAsync, Program :394-407; r2 InvalidateAsync + endpoint |
| C6 | 1 | 1 | `price:{sku}`, `cart:{id}`, `lock:stock-recalc`, `ratelimit:` в обоих |
| C7 | 1 | 1 | r1 RedisLock ReleaseScript :511-516; r2 StockRecalculationService ReleaseScript |
| C8 | 1 | 1 | r1 AcquireScript SET NX PX :498, ttl 30 с с продлением; r2 StringSetAsync(…, LockTtl, NotExists), продление 10 с |
| C9 | 1 | 1 | r1 fencing INCR :499 + LostToken + renew :504-509, контракт IStockRecalculator (Ports :226-233); r2 FenceKey INCR + renew + контракт IStockRecalculator. Запись в Mongo у обоих не реализована (порта нет в репозитории), решение заложено в токене и контракте |
| C10 | 1 | 1 | оба Hash `cart:{id}` поля i:{sku}/promo |
| C11 | 1 | 1 | оба Streams + consumer group + ACK (r1 дополнительно dead-letter) |
| C12 | 1 | 1 | оба sorted set скользящее окно в Lua |

Итог G-C: все 2/2.

## RV-C (redis/runs/rv-c-r1, rv-c-r2)
| ед. | r1 | r2 | основание |
|---|---|---|---|
| C1 | 1 | 1 | оба ApiKeyRateLimiter.cs:20, Multiplexer на запрос (blocker) |
| C2 | 1 | 1 | r1 RedisConnection.cs:21; r2 :14/:22; AbortOnConnectFail по умолчанию, сервис не стартует |
| C3 | 1 | 1 | оба PriceCache.cs:22 без TTL (blocker) |
| C4 | 1 | 1 | r1 PriceCache.cs:18 major; r2 :21 major; конкурентные промахи идут все в источник |
| C5 | 1 | 1 | оба PriceEndpoints.cs:12 вебхук не инвалидирует |
| C6 | 1 | 1 | r1 PriceCache.cs:10 (major); r2 :10 (minor, severity не требуется): коллизии ключей |
| C7 | 1 | 1 | r1 RedisLock.cs:15; r2 :17; снятие чужого лока |
| C8 | 1 | 1 | r1 RedisLock.cs:10; r2 :12; лок навсегда (blocker) |
| C9 | 1 | 1 | r1 StockRecalculatorJob.cs:39; r2 :42; потеря лока, два писателя, fencing/продление |
| C10 | 1 | 1 | оба CartStore.cs:16 read-modify-write JSON, нужен Hash |
| C11 | 1 | 1 | оба MailJobQueue.cs:27 Pub/Sub, потеря при рестарте, дубли по репликам (blocker) |
| C12 | 1 | 1 | оба ApiKeyRateLimiter.cs:22-24 фиксированное окно, до 200 на границе (major) |
| P1 | 1 | 1 | OrderStatusCache.cs:7: r1 minor (мягко, не blocker/major); r2 не заявлена |
| P2 | 1 | 1 | CartStore.cs:12 `v2:cart:` не заявлена ни там, ни там |
| O1 | 1 | 1 | оба PriceCache.cs:12 Math.Round (r1 major, r2 blocker) |
| O2 | 1 | 1 | оба ApiKeyRateLimiter.cs:28 ключ API в лог (major) |

Итог RV-C: все 2/2.

## Спорные клетки
- G-B B1 (оба): nack requeue:true на транзитной ошибке; по графе «Засчитывается» принято 1, оператору решить.
- G-B B2 r2: платёж не дедуплицирован своим кодом (опора на ключ шлюзу); 0 по строгому чтению.
- RV-B B7 r1: назван throw на отсутствие платежа без порядка событий; 1 с вопросом.
- RV-B B7/O1 r2: честно 0 (формально не названы).

## Н (находки сверх ключа, без вердикта)
- g-b-r1: WarehouseInboundConsumer.HandleAsync :578-579 при постоянной ошибке Mongo цикл requeue:true без ограничения числа попыток (ядовитое сообщение крутится бесконечно); r2 :705 то же.
- g-c-r2: EmailWorker не ограничивает повторы письма (сам указал в ANSWER); в r1 есть dead-letter после 5 доставок.
- g-b-r1: saga Mongo-репозиторий вне транзакции outbox (сам указал в ANSWER).
- rv-b-r1/r2: SubmitOrderEndpoint.cs:37 `Discount` из клиента без валидации; повтор submit -> DuplicateKey 500 (r1 :42 major, r2 :42 minor) - реальные.
- rv-b-r2: OrderFulfilmentStateMachine :68 нет отката платежа (refund) при сбое отгрузки - реально (B9-соседнее).
- rv-c-r1/r2: PriceEndpoints.cs:12 эндпоинт без аутентификации; ApiKeyRateLimiter.cs:22 ключи от произвольного заголовка раздувают Redis - реальные.
