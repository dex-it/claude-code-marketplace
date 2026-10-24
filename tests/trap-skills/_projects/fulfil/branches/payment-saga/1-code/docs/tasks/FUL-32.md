# FUL-32: платёжный процесс заказа и приход товара со склада

- `WarehouseInboundConsumer` читает `warehouse.inbound` через RabbitMQ.Client, увеличивает `stock` и отвечает в `warehouse.outbound`.
- `CapturePaymentConsumer` (MassTransit) списывает деньги через `IPaymentGateway`; `OrderShippedConsumer` фиксирует отгрузку в заказе.
- `OrderFulfilmentStateMachine`: `OrderSubmitted` -> `ReserveStock` -> `CapturePayment` -> `ShipOrder`, состояние саг хранится в MongoDB.
- `POST /orders/{id}/submit` сохраняет заказ и публикует `OrderSubmitted`. `IMongoClient` - singleton.
