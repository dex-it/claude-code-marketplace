---
name: rabbitmq
description: RabbitMQ — MassTransit, retry, dead-letter, idempotency, ловушки. Активируется при rabbitmq, message queue, masstransit, consumer, dead-letter, saga, amqp, amqplib, exchange, queue, binding, prefetch, ack, nack
---

# RabbitMQ — ловушки и anti-patterns

## Consumer

### autoAck: true — потеря сообщений
Плохо: `channel.BasicConsume("orders", autoAck: true, consumer)` — ack отправляется до обработки
Правильно: `autoAck: false` → `BasicAck(deliveryTag)` после успешной обработки, `BasicNack(requeue: false)` → DLQ при ошибке
Почему: consumer crash после получения, но до обработки → сообщение потеряно навсегда. Broker считает delivered

### Consumer без idempotency
Плохо: `await _service.ChargeCustomer(context.Message.OrderId)` — без проверки дубликата
Правильно: проверка MessageId перед обработкой: `if (await _cache.GetStringAsync(messageId) != null) return`
Почему: RabbitMQ = at-least-once delivery. Retry, redelivery, network glitch → двойное списание, двойная отправка email

### prefetchCount не настроен
Плохо: `prefetchCount = 0` (unlimited) — broker отправляет все сообщения consumer'у сразу
Правильно: `channel.BasicQos(prefetchSize: 0, prefetchCount: 10, global: false)` — по 10 сообщений
Почему: 100K сообщений в памяти consumer → OOM. Другие consumers простаивают — весь backlog у одного

## Delivery гарантии

### Publish без Outbox — потеря event
Плохо: `SaveChangesAsync()` → `Publish(new OrderCreated(...))` — crash между ними = event потерян
Правильно: Outbox pattern — event сохраняется в той же транзакции, BackgroundService публикует из outbox
Почему: DB commit прошёл, publish упал → order создан, но никто не узнал. Inconsistency между сервисами

### Transient queue для important data
Плохо: `QueueDeclare(durable: false)` или `BasicPublish(persistent: false)` — данные в памяти
Правильно: `durable: true` для queue + `persistent: true` (DeliveryMode=2) для messages
Почему: RabbitMQ restart → non-durable queue исчезает с содержимым. Non-persistent messages теряются при нехватке RAM

## MassTransit

### Retry без стратегии — бесконечный цикл
Плохо: `UseMessageRetry(r => r.Immediate(int.MaxValue))` — ошибка повторяется вечно
Правильно: трёхуровневая стратегия: retry (in-memory, 3 раза) → scheduled redelivery (через очередь, 3 раза) → DLQ (`{queue}_error`)
Почему: poison message → бесконечный retry → CPU 100%, очередь не движется, все остальные сообщения ждут

### Consumer зависит от порядка сообщений
Плохо: `OrderShipped` consumer ожидает что `OrderPaid` уже обработан
Правильно: consumer обрабатывает сообщение в любом порядке, или используй Saga для координации
Почему: RabbitMQ не гарантирует порядок при нескольких consumers, redelivery, или разных очередях

## Saga ловушки

### Нет CorrelationId → новый инстанс на каждый event
Плохо: Saga без маппинга `CorrelateById(ctx => ctx.Message.OrderId)` → каждое событие создаёт новый state machine
Правильно: `Event(() => OrderSubmitted, x => x.CorrelateById(ctx => ctx.Message.OrderId))` — все events одного заказа → один инстанс
Почему: без корреляции 100 events = 100 инстансов Saga. Compensation никогда не сработает — она ищет несуществующий инстанс

### Saga без compensation на каждом шаге
Плохо: Order → Payment → Shipping. Payment прошёл, Shipping упал → деньги списаны, товар не отправлен
Правильно: каждый шаг имеет compensating action: `When(PaymentFailed).Publish(new CancelOrder(...))`
Почему: без compensation система застревает в неконсистентном состоянии. Ручной откат = самая дорогая ошибка

### Saga state не персистится
Плохо: `InMemorySagaRepository` в production
Правильно: `EntityFrameworkSagaRepository` или `RedisSagaRepository`
Почему: app restart → все in-flight sagas потеряны. Заказы застряли в промежуточном состоянии навсегда
