---
name: rabbitmq-patterns
description: RabbitMQ — MassTransit, retry, dead-letter, idempotency, ловушки. Активируется при rabbitmq, message queue, masstransit, consumer, dead-letter, saga
allowed-tools: Read, Grep, Glob
---

# RabbitMQ Patterns

## Правила

- MassTransit для production, RabbitMQ.Client для простых случаев
- autoAck: false + manual ack/nack — не теряй сообщения
- Idempotent consumers — сообщение может прийти дважды
- Dead-letter queue для failed messages — не глотай ошибки
- prefetchCount для throttling — не грузи consumer всей очередью
- Durable queues + persistent messages для important data

## Анти-паттерны

```csharp
// Плохо — autoAck: true → потеря сообщений при crash
channel.BasicConsume("orders", autoAck: true, consumer);
// consumer упал после получения, но до обработки → сообщение потеряно

// Хорошо — manual ack после успешной обработки
channel.BasicConsume("orders", autoAck: false, consumer);
// в handler:
try
{
    await ProcessMessage(message);
    channel.BasicAck(deliveryTag, multiple: false);
}
catch (Exception)
{
    channel.BasicNack(deliveryTag, multiple: false, requeue: false); // → DLQ
}

// Плохо — consumer без idempotency
public async Task Consume(ConsumeContext<OrderCreated> context)
{
    await _service.ChargeCustomer(context.Message.OrderId); // дублирование оплаты!
}

// Хорошо — проверка дубликата
public async Task Consume(ConsumeContext<OrderCreated> context)
{
    var messageId = context.MessageId?.ToString();
    if (await _cache.GetStringAsync(messageId) != null) return; // уже обработано

    await _service.ChargeCustomer(context.Message.OrderId);

    await _cache.SetStringAsync(messageId, "processed",
        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24) });
}

// Плохо — publish в контроллере без транзакции
public async Task<IActionResult> CreateOrder(OrderRequest request)
{
    _context.Orders.Add(order);
    await _context.SaveChangesAsync(ct);        // 1. DB сохранено
    await _publishEndpoint.Publish(new OrderCreated(order.Id)); // 2. crash тут → event потерян!
}

// Хорошо — Outbox pattern (event сохраняется в той же транзакции)
_context.Orders.Add(order);
_context.OutboxMessages.Add(new OutboxMessage { Type = "OrderCreated", Content = ... });
await _context.SaveChangesAsync(ct); // одна транзакция!
// BackgroundService публикует из outbox
```

## Exchange Types — когда какой

| Exchange | Routing | Когда |
|----------|---------|-------|
| Direct | exact routing key | Один consumer, конкретная очередь |
| Topic | pattern (`order.*`, `#.error`) | Фильтрация по паттерну |
| Fanout | broadcast (все очереди) | Уведомления, broadcast |
| Headers | по заголовкам | Сложная маршрутизация |

## MassTransit Retry

```csharp
// Retry + redelivery + DLQ — трёхуровневая стратегия
cfg.UseMessageRetry(r => r.Incremental(3, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2)));
// 3 retry in-memory → если всё fail:
cfg.UseScheduledRedelivery(r => r.Intervals(TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(5)));
// redelivery через очередь → если всё fail → DLQ (MassTransit создаёт автоматически: {queue}_error)
```

## Saga — state machine

```csharp
// Когда: multi-step business process с compensation
// Order → Payment → Shipping → Done
// Payment failed → Cancel Order (compensation)

public class OrderStateMachine : MassTransitStateMachine<OrderState>
{
    public State Submitted { get; private set; }
    public State PaymentPending { get; private set; }
    public State Completed { get; private set; }
    public State Faulted { get; private set; }

    public OrderStateMachine()
    {
        InstanceState(x => x.CurrentState);

        Initially(
            When(OrderSubmitted)
                .TransitionTo(Submitted)
                .Publish(ctx => new ProcessPayment(ctx.Message.OrderId)));

        During(Submitted,
            When(PaymentCompleted).TransitionTo(Completed),
            When(PaymentFailed).TransitionTo(Faulted)
                .Publish(ctx => new CancelOrder(ctx.Message.OrderId))); // compensation
    }
}
```

## Чек-лист

- [ ] autoAck: false + manual ack
- [ ] Idempotent consumers (проверка дубликата)
- [ ] DLQ для failed messages
- [ ] Outbox pattern для guaranteed delivery
- [ ] prefetchCount настроен (не 0/unlimited)
- [ ] Durable queues + persistent messages
- [ ] Retry policy (incremental/exponential)
- [ ] Graceful shutdown (drain consumers)
