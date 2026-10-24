# Судья: kafka, набор n (редакция скилла: 3 пункта-названия, в ключ не входит)

Столбцы c1/c2 = прогоны n1/n2.

## G-K (код; DIFF.patch прогонов g-k-n1, g-k-n2)

| единица | n1 | n2 | основание |
|---|---|---|---|
| K1 | 1 | 1 | n1 KafkaSupport.cs: `await _producer.ProduceAsync` в PublishStatusChangedAsync, вызов внутри Retry.RunAsync (OrderConsumers.cs, ветка else) - сбой доставки повторяется; n2 KafkaPublisher.cs `await _producer.ProduceAsync` в PublishAsync, внутри RetryAsync (OrderPlacedWorker.cs) |
| K2 | 1 | 1 | n1 KafkaSupport.cs Key = `placed.OrderId.ToString()`; n2 OrderPlacedWorker.cs ключ `order.OrderId.ToString()` |
| K3 | n/a ? | n/a ? | все публикации через `await ProduceAsync`, буфера нет (оба прогона). Flush(5с/10с) перед Dispose всё же есть (n1 KafkaSupport.cs Dispose, n2 KafkaPublisher.cs Dispose); по тексту ключа клетка n/a, при ином чтении было бы 1/1 |
| K4 | 1 | 1 | `EnableIdempotence = true` в ProducerConfig обоих прогонов |
| K5 | 1 | 1 | n1 ConsumerFactory: EnableAutoOffsetStore=false + автокоммит, `StoreOffset(r)` после обработки; n2 ConsumerWorker.cs те же настройки, StoreOffset после RetryAsync |
| K6 | 1 ? | 1 ? | orders.placed: StoreOffset после каждого сообщения, CooperativeSticky; обработчика отзыва нет. Импорт: смещения сохраняются по пачке до 100 после записи (n1 OrderConsumers.cs `foreach ... StoreOffset`, n2 OrderImportWorker.cs). Накопленных обработанных-но-несохранённых смещений нет, коммитится только сохранённое; спорно только из-за пачки в 100 |
| K7 | 1 | 1 | n1 OrderStores.cs ApplyAsync: фильтр `Ne("processedOrders", orderId)` + `$addToSet` + upsert, DuplicateKey = уже учтён; n2 MongoStores.cs: `Ne("recentOrderIds")` + `$push $slice -1000` в одном апдейте. Оговорка: у n2 окно 1000 последних, повтор старше окна учтётся дважды (ключ это допускает: "условный апдейт с проверкой OrderId") |
| K8 | 0 ? | 0 ? | не разбирающиеся сообщения уходят в `.dlq` сразу и партиция продвигается (n1 OrderConsumers.cs poison-ветка; n2 OrderPlacedWorker.cs catch JsonException). Но "не обрабатывается": Retry.RunAsync (n1 KafkaSupport.cs) / RetryAsync (n2 ConsumerWorker.cs) - `while (true)` без лимита попыток и без передачи на разбор: детерминированный сбой обработки остаётся бесконечным повтором на месте, что ключ называет провалом. Спорно: код трактует сбои как временные Mongo/брокера |
| K9 | 1 | 1 | n1 OrderConsumers.cs: StoreOffset всей пачки только после `Retry.RunAsync(InsertBatchAsync)`, нечитаемые уходят в DLQ; n2 OrderImportWorker.cs: то же, после `RetryAsync(InsertBatchAsync)` |
| K10 | 1 | 1 | `bool GiftWrap = false` в OrderPlaced (n1 OrderEvents.cs:5, n2 OrderEvents.cs), JsonSerializerDefaults.Web не падает на неизвестных полях |

## RV-K (ревью; REVIEW.md прогонов rv-k-n1, rv-k-n2)

| единица | n1 | n2 | основание |
|---|---|---|---|
| K1 | 1 | 1 | n1 OrderStatusPublisher.cs:26-47 `Produce` без колбэка, ошибка доставки не видна, статус теряется; n2 :29-37 то же |
| K2 | 1 | 1 | n1 :30 Guid.NewGuid, порядок статусов заказа не гарантирован; n2 :31 то же |
| K3 | 1 | 1 | n1 :46 Dispose без Flush, неотправленное теряется при остановке (minor); n2 :47 то же. Строка у n2 :47 вместо :46 - в пределах метода Dispose, засчитано |
| K4 | 1 | 1 | n1 :18-23, n2 :19-24 без EnableIdempotence, дубли и переупорядочение |
| K5 | 1 | 1 | n1 OrderPlacedConsumer.cs:34-39 смещение уходит до обработки, потеря; n2 :39 автокоммит по таймеру, необработанное теряется |
| K6 | 1 | 1 | n1 OrderImportConsumer.cs:64-65 коммит раз в 10 пачек, нет обработчиков ребаланса, повторное чтение; n2 :65-66 то же |
| K7 | 1 | 1 | n1 OrderPlacedConsumer.cs:86-96, n2 :88-90 `$inc` не идемпотентен, счётчики удваиваются |
| K8 | 1 | 1 | n1 OrderPlacedConsumer.cs:61-77 вечный повтор, партиция встаёт; n2 :60-76 то же |
| K9 | 1 | 1 | n1 OrderImportConsumer.cs:55-62 `finally` продвигает смещение, пачка теряется; n2 :62-69 то же |
| K10 | 1 | 1 | n1 OrderEvents.cs:4 `Lines`->`Items`, старые продьюсеры дают Items==null, NRE; n2 :4 то же |
| P1 | 1 | 1 | n1 не заявляет (отмечает, что повтор заказа upsert-ом защищён); n2 OrderPlacedConsumer.cs:84 только minor (откат статуса), blocker/major нет |
| P2 | 1 | 1 | ключ customerId в customers.touched не оспаривается ни в одном прогоне |
| O1 | 1 | 1 | n1 OrderPlacedConsumer.cs:86-89 `Quantity + UnitPrice` вместо произведения; n2 :87 то же |
| O2 | 1 | 1 | n1 OrderPlacedConsumer.cs:90 ContactEmail в лог (major); n2 :91 то же со ссылкой на ADR-0002 |

## Итог по единицам (по всем кейсам, где есть клетка)

| единица | итог |
|---|---|
| K1 | 4/4 (код 2/2, ревью 2/2) |
| K2 | 4/4 |
| K3 | код n/a (?), ревью 2/2 |
| K4 | 4/4 |
| K5 | 4/4 |
| K6 | 4/4 (код оба "?" из-за пачки в 100 при импорте) |
| K7 | 4/4 |
| K8 | код 0/2 (?), ревью 2/2: итого 2/4, единица держится по коду |
| K9 | 4/4 |
| K10 | 4/4 |
| P1 | 2/2 |
| P2 | 2/2 |
| O1 | 2/2 |
| O2 | 2/2 |

## Н (находки сверх ключа, без вердикта)
- Обе проверки RV: у `finally` в OrderImportConsumer без перехвата `Commit` по отозванным партициям валит BackgroundService (оба прогона, :64-66) - похоже на настоящую.
- RV n2: ReplaceOne/upsert на повторной доставке откатывает статус заказа в Placed (OrderPlacedConsumer.cs:84) - реальная, но в ключе это приманка P1 (minor, не провал).
- RV: `ContactEmail` добавлен в контракт вне описания MR (оба) - сам ключ называет это отклонением ветки, не дефектом.
- Код: DLQ-топик `*.dlq` вместо `*.DLT`, создание топиков - на платформе (оба ответа это оговаривают).
- Код n1: массив `processedOrders` растёт без границы (сам исполнитель это указал); n2: окно 1000.
- Код n1: Program.cs `var app =builder.Build();` - опечатка форматирования, не ошибка.
