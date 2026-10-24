# Судья: rabbitmq, набор n (колонки c1/c2 = n1/n2)

## g-b (код)
| единица | n1 | n2 | основание |
|---|---|---|---|
| B1 | 1 ? | 1 ? | n1 DIFF:645 autoAck:false, :684 ack после записи, :666/:724 Park в error-очередь + ack; но :640 Nack requeue:true на сбое. n2 DIFF:590 autoAck:false, :636 ack после записи, :628 Reject requeue:false для битых; :642 Nack requeue:true на сбое. Пункт ключа «без возврата в ту же очередь» буквально нарушен на временных сбоях (возврат с паузой 1-2 с, для ядовитых - отдельный путь) |
| B2 | 1 | 1 | n1 :698 маркер messageId в транзакции, :86 проверка payments; n2 :655 previous по messageId, :180 проверка Captured |
| B3 | 1 | 1 | n1 :627 BasicQosAsync(0,50); n2 :586 BasicQosAsync(0,50) |
| B4 | 1 | 1 | n1 :379-444 MongoDb outbox + транзакция; n2 :267-273, :496-513 то же |
| B5 | 1 | 1 | очередь склада не объявляется (passive, n1 :624, n2 :583); публикации Persistent: n1 :681, :722; n2 :678; собственная error-очередь n1 :626 durable:true |
| B6 | 1 | 1 | n1 :130-134 Exponential(5)+Ignore declined; n2 :277 Exponential(6), затем _error |
| B7 | 1 | 1 | порядок задан сагой (n1 Saga/…:505-551; n2 Fulfilment/OrderFulfilmentStateMachine.cs:372-413); зависимого чужого консьюмера нет, допустимо и n/a - засчитано по «порядок задан сагой» |
| B8 | 1 | 1 | n1 :495-503, n2 :362-370 CorrelateById на всех событиях, Fault - по Message.OrderId |
| B9 | 1 | 1 | n1 :531 Declined->ReleaseStock, :536-538 и :548-549 Refund+Release; n2 :396 Release, :410-411 Refund+Release |
| B10 | 1 | 1 | n1 :396 MongoDbRepository; n2 :297 MongoDbRepository |

## rv-b (ревью payment-saga)
| единица | n1 | n2 | основание (REVIEW.md) |
|---|---|---|---|
| B1 | 1 | 1 | оба: WarehouseInboundConsumer.cs:52 autoAck:true, потеря прихода (blocker) |
| B2 | 1 | 1 | оба: WarehouseInbound:69 Inc без дедупа; Capture:26 двойное списание |
| B3 | 1 | 1 | n1 :40 нет BasicQos, OOM; n2 :52 нет BasicQos, OOM (строка рядом с ключом :38-39, последствие названо) |
| B4 | 1 | 1 | оба: SubmitOrderEndpoint.cs:42, нужен outbox |
| B5 | 1 | 1 | оба: WarehouseInboundConsumer.cs:38 durable:false, потеря очереди (Persistent на :74 не упомянут, место :38 и последствие есть) |
| B6 | 1 | 1 | оба: PaymentsServiceCollectionExtensions.cs:24 Immediate(int.MaxValue) |
| B7 | 0 | 1 | n1: OrderShippedConsumer.cs:22 не упомянут; n2: :22 исключение при отсутствии платежа, цикл ретраев |
| B8 | 1 | 1 | оба: StateMachine.cs:34 (и :38) без CorrelateById |
| B9 | 1 | 1 | n1 :57/:64 резерв не снимается; n2 :64 то же (blocker) |
| B10 | 1 | 1 | оба: ServiceCollectionExtensions.cs:18 InMemoryRepository (blocker) |
| P1 | 1 | 1 | StockLevelsConsumer:17 как дефект дедупа не заявлен; n1 :15 - minor про null MessageId (иное); n2 не упоминает |
| P2 | 1 | 1 | StockLevelsConsumer:26-27 не заявлен ни в одном |
| O1 | 1 ? | 1 | n2 CapturePaymentConsumer.cs:25 Discount не применяется. n1 назван на SubmitOrderEndpoint:37 («Total без Discount… клиент платит полную цену»): по существу верно, место не то, что в ключе (:25) - ? |
| O2 | 1 | 1 | оба: CapturePaymentConsumer.cs:34 ReceiptEmail в лог |

## Итог по единицам (g-b: n1,n2; rv-b: n1,n2; 4 клетки, у всех единиц есть клетка во всех)
| единица | g-b | rv-b | итого |
|---|---|---|---|
| B1 | 2/2 ? | 2/2 | 4/4 (? в g-b: Nack requeue:true на временных сбоях) |
| B2 | 2/2 | 2/2 | 4/4 |
| B3 | 2/2 | 2/2 | 4/4 |
| B4 | 2/2 | 2/2 | 4/4 |
| B5 | 2/2 | 2/2 | 4/4 |
| B6 | 2/2 | 2/2 | 4/4 |
| B7 | 2/2 | 1/2 | 3/4 (rv-b-n1: 0) |
| B8 | 2/2 | 2/2 | 4/4 |
| B9 | 2/2 | 2/2 | 4/4 |
| B10 | 2/2 | 2/2 | 4/4 |
| P1, P2 | - | 2/2 | 2/2 |
| O1 | - | 2/2 ? | n1 место иное |
| O2 | - | 2/2 | 2/2 |

## Н (сверх ключа, без вердикта)
- g-b-n1 и g-b-n2: `UpdateOne` / `Nack requeue:true` на любом исключении без счётчика повторов - сообщение, стабильно роняющее обработку (не парсинг), крутится по кругу.
- g-b-n1 Program.cs:437-440: при DuplicateKey вызывается AbortTransaction, а затем возврат без Rollback outbox-контекста - возможна утечка сессии; API по памяти (сам исполнитель оговорил).
- g-b-n2 `OrderStatusConsumer` перезаписывает статус без защиты от переупорядочения (Paid после Shipped возможен); n1 это учёл (OrderConsumers.cs:55).
- g-b-n1 ack входящего после публикации подтверждения: возможен дубль подтверждения (исполнитель сам оговорил).
- rv-b-n1/n2: находка про `ReserveStock/ShipOrder` без консьюмеров (Messages.cs) - по существу верна (сага ждёт чужие обработчики; в ключе это отмечено как допущение, поэтому не засчитана как дефект).
- rv-b-n2: Failed не финализируется, саги копятся - по существу верно.
