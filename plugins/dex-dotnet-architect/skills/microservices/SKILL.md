---
name: microservices
description: Микросервисная архитектура, паттерны коммуникации, CQRS. Активируется при microservices, микросервисы, API gateway, service mesh, event-driven
allowed-tools: Read, Grep, Glob
---

# Microservices

## Когда использовать

**Подходят если:**
- Большая команда (>10 разработчиков)
- Разные части требуют разного масштабирования
- Нужна независимая доставка компонентов
- Сложный домен с четкими границами

**НЕ подходят если:**
- Маленькая команда (<5)
- Простой домен
- Нет DevOps экспертизы
- Startup/MVP фаза

## Паттерны коммуникации

### Synchronous (HTTP/gRPC)

```csharp
// HTTP Client с Polly
services.AddHttpClient<CatalogServiceClient>(client =>
{
    client.BaseAddress = new Uri("http://catalog-service");
})
.AddTransientHttpErrorPolicy(p =>
    p.WaitAndRetryAsync(3, _ => TimeSpan.FromSeconds(2)))
.AddTransientHttpErrorPolicy(p =>
    p.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30)));
```

### Asynchronous (Message Broker)

```csharp
// MassTransit + RabbitMQ
public record OrderCreatedEvent(int OrderId, int CustomerId);

// Publisher
await _publishEndpoint.Publish(new OrderCreatedEvent(order.Id, order.CustomerId));

// Consumer
public class OrderCreatedConsumer : IConsumer<OrderCreatedEvent>
{
    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        await _notificationService.SendAsync(context.Message.CustomerId);
    }
}
```

## API Gateway (YARP)

```json
{
  "ReverseProxy": {
    "Routes": {
      "catalog-route": {
        "ClusterId": "catalog-cluster",
        "Match": { "Path": "/api/products/{**catch-all}" }
      }
    },
    "Clusters": {
      "catalog-cluster": {
        "Destinations": {
          "catalog-1": { "Address": "http://catalog-service:8080" }
        }
      }
    }
  }
}
```

## Saga Pattern

```csharp
// Choreography - каждый сервис слушает события
public class PaymentCompletedConsumer : IConsumer<PaymentCompletedEvent>
{
    public async Task Consume(ConsumeContext<PaymentCompletedEvent> context)
    {
        await _orderService.ConfirmOrderAsync(context.Message.OrderId);
    }
}

public class PaymentFailedConsumer : IConsumer<PaymentFailedEvent>
{
    public async Task Consume(ConsumeContext<PaymentFailedEvent> context)
    {
        await _orderService.CancelOrderAsync(context.Message.OrderId);
    }
}
```

## Outbox Pattern

```csharp
// Сохраняем event вместе с данными в одной транзакции
_context.Orders.Add(order);
_context.OutboxMessages.Add(new OutboxMessage
{
    Type = typeof(OrderCreatedEvent).FullName,
    Content = JsonSerializer.Serialize(new OrderCreatedEvent(order.Id))
});
await _context.SaveChangesAsync(ct);  // Одна транзакция!

// Background job публикует events
```

## Health Checks

```csharp
services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "database")
    .AddRabbitMQ(rabbitConnectionString, name: "rabbitmq");

app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready");
app.MapHealthChecks("/health/live");
```

## Чек-лист

- Каждый сервис имеет свою БД
- Коммуникация через API Gateway
- Async events для cross-service communication
- Circuit Breaker для sync calls
- Outbox pattern для guaranteed delivery
- Health checks для всех сервисов
- Distributed tracing
- Centralized logging
- API versioning
- Idempotent consumers
