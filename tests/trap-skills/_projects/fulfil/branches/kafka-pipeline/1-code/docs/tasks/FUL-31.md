# FUL-31: Kafka - статусы заказов, учёт клиентов и импорт

- `OrderStatusPublisher` пишет `OrderStatusChanged` в `orders.status-changed` и событие касания клиента в `customers.touched`.
- `OrderPlacedConsumer` читает `orders.placed` (группа `fulfil-orders`), обновляет `customers` (`ordersCount`, `totalSpent`) и публикует статус `Placed`.
- `OrderImportConsumer` читает `orders.import` пачками по 100 и пишет заказы в `orders` одним `InsertMany` на пачку.
- Контракт `OrderPlaced`: позиции теперь в `Items`, добавлено `GiftWrap`. `IMongoClient` зарегистрирован как singleton.
