src/Fulfil/Payments/WarehouseInboundConsumer.cs:52 - autoAck: true плюс проглатывание исключений в строках 47-50: любой сбой Mongo/публикации/парсинга безвозвратно теряет приход товара, а склад не получит ответа - blocker
src/Fulfil/Payments/WarehouseInboundConsumer.cs:52 - нет BasicQosAsync (prefetch) у прямого консьюмера: весь backlog warehouse.inbound уйдёт в память пода, возможен OOM - major
src/Fulfil/Payments/WarehouseInboundConsumer.cs:69 - увеличение stock и публикация ответа в warehouse.outbound двумя отдельными шагами: падение между ними оставит stock увеличенным без ответа, склад повторит отправку - major
src/Fulfil/Payments/WarehouseInboundConsumer.cs:69 - $inc не идемпотентен, MessageId не проверяется: при повторной доставке (после перехода на ack/nack) stock задвоится - major
src/Fulfil/Payments/WarehouseInboundConsumer.cs:38 - очередь объявлена durable: false: при рестарте брокера очередь и непринятые приходы пропадают - major
src/Fulfil/Payments/WarehouseInboundConsumer.cs:73 - публикация в warehouse.outbound без QueueDeclare/ExchangeDeclare и с mandatory=false: при отсутствии обменника канал закроется, при отсутствии привязки ответ молча пропадёт - minor
src/Fulfil/Payments/WarehouseInboundConsumer.cs:49 - в лог пишется только имя типа исключения, без самого исключения и MessageId: сбои не диагностируются - minor
src/Fulfil/Payments/PaymentsServiceCollectionExtensions.cs:18 - InMemoryRepository вместо MongoDB (по FUL-32 состояние саг в MongoDB): рестарт пода теряет все незавершённые заказы, масштабирование на несколько подов ломает корреляцию - blocker
src/Fulfil/Payments/PaymentsServiceCollectionExtensions.cs:11 - IPaymentGateway нигде не зарегистрирован в DI: CapturePaymentConsumer не создаётся, ни один платёж не пройдёт - blocker
src/Fulfil/Payments/PaymentsServiceCollectionExtensions.cs:24 - Immediate(int.MaxValue) на всей шине: ошибочное сообщение (в т.ч. CapturePayment) повторяется бесконечно без пауз, нагрузка на Mongo/шлюз, очередь блокируется poison-сообщением, до dead-letter не дойдёт - major
src/Fulfil/Payments/PaymentsServiceCollectionExtensions.cs:20 - нет Mongo/bus outbox в конфигурации MassTransit: публикации из консьюмеров и саги не атомарны с изменением состояния - major
src/Fulfil/Payments/OrderFulfilmentStateMachine.cs:34 - OrderSubmitted не коррелируется по OrderId: CorrelationId саги будет сгенерирован, а StockReserved/OrderPaid/OrderShipped ищут сагу по OrderId и не найдут - процесс заказа встанет после первого шага - blocker
src/Fulfil/Payments/OrderFulfilmentStateMachine.cs:38 - Fault<CapturePayment> без CorrelateById: сбой платежа не найдёт сагу, она навсегда останется в Capturing - major
src/Fulfil/Payments/OrderFulfilmentStateMachine.cs:64 - при PaymentFailed переход в Failed без ReleaseStock: резерв остаётся навсегда, товар недоступен для продажи (сообщение ReleaseStock объявлено, но нигде не используется) - blocker
src/Fulfil/Payments/OrderFulfilmentStateMachine.cs:68 - нет отката после оплаты: при сбое отгрузки нет ни возврата платежа (RefundAsync), ни ReleaseStock, ни перехода в Failed - деньги списаны, заказ не отгружен - blocker
src/Fulfil/Payments/OrderFulfilmentStateMachine.cs:49 - ReserveStock и ShipOrder (строка 62) публикуются, но консьюмеров для них в PR нет: сага зависнет в Reserving/Shipping - blocker
src/Fulfil/Payments/CapturePaymentConsumer.cs:26 - списание через шлюз, запись в Mongo и Publish - три отдельных шага без идемпотентности; при повторе (бесконечный retry) клиента спишут повторно, а InsertOne упадёт на дубле _id - blocker
src/Fulfil/Payments/CapturePaymentConsumer.cs:25 - Discount в CapturePayment передаётся, но не применяется: списывается полный Total, клиент переплачивает - major
src/Fulfil/Payments/CapturePaymentConsumer.cs:36 - Publish OrderPaid после записи без outbox: падение между ними оставит платёж списанным, а сагу в Capturing навсегда - major
src/Fulfil/Payments/CapturePaymentConsumer.cs:34 - email клиента (ПДн) пишется в лог в открытом виде - minor
src/Fulfil/Payments/SubmitOrderEndpoint.cs:42 - InsertOne заказа и Publish OrderSubmitted двумя шагами: падение между ними оставит заказ в Placed без события, сага не стартует, заказ завис - blocker
src/Fulfil/Payments/SubmitOrderEndpoint.cs:42 - повторный submit того же id даёт необработанный DuplicateKey (500) вместо идемпотентного ответа - minor
src/Fulfil/Payments/SubmitOrderEndpoint.cs:30 - нет валидации Discount (может быть отрицательным или больше суммы), Quantity/UnitPrice и ReceiptEmail: возможен некорректный/нулевой/отрицательный Total - major
src/Fulfil/Payments/OrderShippedConsumer.cs:23 - при отсутствии платежа бросается исключение, а в связке с бесконечным retry сообщение крутится вечно - minor
src/Fulfil/Payments/OrderShippedConsumer.cs:24 - результат UpdateOne (MatchedCount) не проверяется: если заказа нет, отгрузка молча «зафиксирована» - minor
src/Fulfil/Payments/StockLevelsConsumer.cs:15 - при MessageId == null берётся новый Guid, upsert перестаёт быть идемпотентным и дублирует снимки при повторах - minor
