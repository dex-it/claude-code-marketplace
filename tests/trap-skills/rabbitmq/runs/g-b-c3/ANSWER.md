Задача FUL-12 выполнена в рабочем дереве, без коммита. Сборки нет, поэтому код не компилировался и не запускался. API MassTransit и RabbitMQ.Client писал по памяти, проверьте его на CI.

**Изменённые файлы**
- Изменены: `src/Fulfil/Program.cs`, `Options/FulfilOptions.cs`, `appsettings.json`, `Ports/Ports.cs` (добавлен `PaymentDeclinedException`), `docker-compose.yml` (том и `hostname` для RabbitMQ).
- Новые:
  - `Contracts/PaymentFlow.cs`
  - `Saga/OrderState.cs`, `OrderStateMachine.cs`, `OrderStateDefinition.cs`
  - `Payments/PaymentRecord.cs`, `CapturePaymentConsumer.cs`, `RefundPaymentConsumer.cs`
  - `Endpoints/OrderEndpoints.cs`
  - `Warehouse/WarehouseInboundWorker.cs`

**Принятые решения**
- **Процесс и платежи:**
  - Процесс — сага MassTransit в MongoDB (`order_sagas`, оптимистичные версии для 3 реплик). При неудаче шага она шлёт `ReleaseStock` и `RefundPayment`, завершённые экземпляры не удаляются.
  - `CapturePayment` не списывает деньги повторно: итог хранится в `payments` по `orderId`. К 10 000 команд в минуту рассчитаны 128 одновременных вызовов на реплику и prefetch 256, плюс повторы и автомат размыкания при падении шлюза. Очереди кворумные, durable.
  - В `IPaymentGateway` нет ключа идемпотентности. Если сервис упадёт между списанием и записью в `payments`, при повторе возможно двойное списание.
- **Submit:** `POST /orders/{id}/submit` берёт цены из `IPriceSource`, а не из запроса. Заказ вставляется в `orders`, затем публикуется `OrderSubmitted`. Повторный запрос публикует событие снова, сага дубликат игнорирует. Transactional outbox не делал: Mongo в compose — один узел без replica set, транзакций нет.
- **Склад:**
  - `WarehouseInboundWorker` читает `warehouse.inbound` с ручным ack. Очередь только проверяется, не объявляется, потому что она чужая.
  - Инкремент `stock` и запись `messageId` — одна атомарная операция над документом товара, так что повторная доставка безопасна. Подтверждение уходит в `warehouse.outbound` с publisher confirms. Авто-восстановление и цикл повторов переживают перезапуск RabbitMQ.
  - Битые сообщения и приходы по неизвестному sku отклоняются без возврата в очередь.
  - Имена полей `sku`, `stock` — предположение: я включил camelCase для всего Mongo, схему `products` не видел.

**Не сделано**
- Нет реализаций `IPaymentGateway` и `IPriceSource` (формат шлюза вне задачи), без них приложение не стартует.
- Нет потребителей `ReserveStock`, `ReleaseStock` и `ShipOrder` — в задаче их нет. Эти команды копятся в своих очередях, процесс остановится на резерве.
- Статус заказа в `orders` не обновляется. Сага публикует `OrderStatusChanged`, подписчика нет.
