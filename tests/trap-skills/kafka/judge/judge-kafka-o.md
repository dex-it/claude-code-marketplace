# Судья: СКИЛЛ=kafka, набор o, кейс G-K (g-k-o1, g-k-o2)

Колонки: o1 | o2. Номера строк - DIFF.patch своего прогона.

| единица | o1 | o2 | основание |
|---|---|---|---|
| K1 | 1 | 1 | o1: KafkaPublisher.PublishAsync await ProduceAsync (103), вызов в ProcessAsync (398) под повтором HandleAsync (367-383) -> DLT; o2: PublishJsonAsync возвращает Task ProduceAsync (199-204), await в TryWithRetriesAsync (426-431) |
| K2 | 1 | 1 | o1: ключ order.OrderId.ToString() (398, Key 105); o2: то же (428, Key 202) |
| K3 | n/a | n/a | все публикации ожидаются через await ProduceAsync, буфера нет (Flush до Dispose всё же есть: o1:132, o2:226) |
| K4 | 1 | 1 | o1:95 EnableIdempotence = true; o2:193 |
| K5 | 1 | 1 | o1: EnableAutoCommit=false (334), Commit после HandleAsync (353-354, 417); o2: 111, Commit после HandleAsync (395-397) |
| K6 | 1 | 1 | o1: Commit после каждого сообщения (354), коммент 307; o2: Commit(result) после каждого сообщения (397); обработчика отзыва нет, но накопленных смещений нет |
| K7 | 1 | 1 | o1: filter Eq _id & Ne appliedOrders + Inc + upsert, дубль _id перехвачен (500-511); o2: Ne recentOrderIds + upsert, DuplicateKey -> false (62-77) |
| K8 | 1 | 1 | o1: MaxProcessingAttempts=5, затем `<топик>.DLT` с телом и причиной в заголовках, смещение после приёма брокером (367-388, 112-128); o2: 3 попытки, JsonException сразу в DLT (139-158, 420-434, 207-222), сбой DLT - исключение без коммита |
| K9 | 1 | 1 | o1: Commit после HandleBatchAsync (204-205), при отказе пачки - поодиночке, виновные в DLT (251-258); o2: Commit после HandleBatchAsync (274-277), та же схема (320-330) |
| K10 | 1 | 1 | o1: `bool GiftWrap = false` (OrderEvents.cs:16), Web-опции игнорируют неизвестные поля (50); o2: то же (16, 177) |

## Итог по единице

| единица | итог |
|---|---|
| K1 | 2/2 |
| K2 | 2/2 |
| K3 | n/a (в обоих прогонах нет ситуации) |
| K4 | 2/2 |
| K5 | 2/2 |
| K6 | 2/2 |
| K7 | 2/2 |
| K8 | 2/2 |
| K9 | 2/2 |
| K10 | 2/2 |

Спорные клетки: K3 (n/a в обоих; Flush присутствует, но по ключу ситуации нет, так как все публикации ожидаются) - если оператор решит засчитывать наличие Flush, обе клетки станут 1. Остальные не спорные.

## Н (сверх ключа, без вердикта)
- o1/o2: фиксация смещения в обработчике не защищена от пропущенного DLT-сбоя: o1 крутит бесконечный повтор DLT (265-273), o2 падает без коммита; оба сохраняют сообщение.
- o2: HandleAsync/Run синхронно блокируют (GetAwaiter().GetResult()) в выделенном потоке - допустимо.
- o2: в OrderImportConsumer не проверяются OrderId/CustomerId == Guid.Empty (o1 проверяет).
- o1: в OrderImportConsumer ловится KafkaException при Commit и только логируется (289) - допустимо при идемпотентной вставке.
- Оба: сборка не проверялась (исполнитель сам об этом сообщил).
