# Судья: СКИЛЛ=rabbitmq

## g-b (код, payment-flow). Пути: runs/g-b-cN/DIFF.patch (строки патча)
| единица | c1 | c2 | основание |
|---|---|---|---|
| B1 | 1 ? | 1 ? | c1 :652 autoAck:false, :694 Ack после confirm, :666/:674 Nack requeue=false на плохих; c2 :608, :655, :630/:638 Reject requeue=false. Оба на транзитном сбое делают Nack requeue=true после паузы (c1 :706, c2 :661) - ключ дословно просит «без возврата»; засчитано, так как провал по ключу - autoAck:true |
| B2 | 1 | 1 | c1 :718 insert messageId в транзакции + :730 DuplicateKey; платёж :74 статус Placed/Paid. c2 :670 `Ne(InboundIds)`; платёж :26 проверка payments |
| B3 | 1 | 1 | c1 :648 BasicQos(0,50); c2 :604 BasicQos(0,20) |
| B4 | 0 | 0 | c1 OrderEndpoints :347 Insert, :360 Publish без защиты (комментарий :358 - «клиент повторит»); c2 :465 Insert, :476 Publish; InMemoryOutbox/ретрай клиента не закрывают падение между шагами |
| B5 | 1 ? | 1 | c1 очередь объявляется пассивно (:646), durable не выбирается; :690 Persistent=true. c2 :603 durable:true, :651 Persistent |
| B6 | 1 | 1 | c1 Program :473 Exponential(8,...) + `_error`; c2 :72 Exponential(5) |
| B7 | 1 | 1 | c1 порядок задаёт сага, ShipOrder (:157) не зависит от записи платежа; c2 ShipOrderConsumer :93 независим, порядок у саги |
| B8 | 1 | 1 | c1 :529-534 CorrelateById на всех событиях; c2 :334-341 включая Fault<> по Message.Message.OrderId |
| B9 | 0 ? | 1 | c1: сбой оплаты -> ReleaseStock (:558), но отката денег при сбое отгрузки нет (нет Refund, :562-566, ANSWER: сбои идут в _error). ? - в c1 нет явного шага отгрузки, который «не удаётся», но task п.1 допускает сбой шага; строго по ключу 0. c2 :368 ReleaseStock при PaymentFailed, :372-375 при Fault<Capture>, :381-384 Refund+Release при Fault<ShipOrder> |
| B10 | 1 | 1 | c1 Program :459 MongoDbRepository; c2 :431 MongoDbRepository |

## rv-b (ревью, payment-saga)
| единица | c1 | c2 | основание |
|---|---|---|---|
| B1 | 1 | 1 | WarehouseInboundConsumer:52 autoAck true, потеря прихода (оба) |
| B2 | 1 | 1 | :69 $inc без дедупа (оба); CapturePaymentConsumer:26 повторное списание (оба) |
| B3 | 0 | 0 | prefetch/BasicQos не упомянут ни в одном |
| B4 | 1 | 1 | SubmitOrderEndpoint:42 нет атомарности/outbox, заказ без саги (оба) |
| B5 | 1 | 1 | :38 durable:false, очередь пропадёт при рестарте брокера (оба; Persistent не упомянут) |
| B6 | 1 | 1 | PaymentsServiceCollectionExtensions:24 Immediate(int.MaxValue), бесконечный цикл |
| B7 | 1 ? | 1 ? | OrderShippedConsumer:22 оба называют исключение при отсутствии платежа и зацикливание; порядок событий (Shipped раньше платежа) не назван, c1 minor. ? - последствие названо слабо |
| B8 | 1 | 1 | StateMachine:34 и :38 без корреляции (оба) |
| B9 | 1 | 1 | c1 :57 «Failed без компенсаций, ReleaseStock не отправляется» (+ «стр. 64»); c2 :64 прямо - ошибка оплаты не освобождает склад |
| B10 | 1 | 1 | :18 InMemoryRepository, потеря при рестарте/3 реплики (оба) |
| P1 StockLevels:17 | 1 | 1 | c1 :14 minor (ключ MessageId/Guid.NewGuid), c2 :15 minor; blocker/major нет |
| P2 StockLevels:26-27 | 1 | 1 | c1 не заявлено; c2 :27 InMemoryOutbox «лишний», minor |
| O1 Capture:25 скидка | 1 | 1 ? | c1 CapturePaymentConsumer:26 «Discount нигде не применяется» major; c2 назвал скидку в SubmitOrderEndpoint:37 (не вычитается в Total, клиент платит не ту сумму) - по существу то же, место иное ? |
| O2 Capture:34 ReceiptEmail в лог | 1 | 1 | c1 :34 minor; c2 :34 major (ADR-0002) |

## Итог по единице (g-b + rv-b, клеток 4 у B1-B10)
B1 4/4 (?: requeue=true на транзитном сбое в коде); B2 4/4; B3 2/4 (код 2/2, ревью 0/2) -> 2/4; B4 2/4 (код 0/2, ревью 2/2); B5 4/4 (? c1 код); B6 4/4; B7 4/4 (? ревью); B8 4/4; B9 3/4 (c1 код 0 ?); B10 4/4.
По режимам: код - B4 0/2, B9 1/2, остальные 2/2; ревью - B3 0/2, остальные 2/2.
P1 2/2, P2 2/2, O1 2/2 (? c2 место), O2 2/2.

## Н (находки сверх ключа, кратко)
- ревью оба: IPaymentGateway не зарегистрирован в DI (Program.cs); ReserveStock/ShipOrder без консьюмеров; валидация/цены от клиента в SubmitOrderEndpoint; обменник warehouse.outbound не объявлен (404 на публикации).
- код c1: окно между ChargeAsync и записью статуса Paid (двойное списание, если шлюз без ключа; признано в ANSWER); изменён compose (replica set) без запроса задачи.
- код c2: ReleaseStockConsumer возвращает остаток по сообщению Lines, не по записи резерва; ReserveStock откатывает вручную без транзакции (частичный откат при падении между шагами).
