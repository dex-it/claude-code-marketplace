---
name: rabbitmq-patterns
description: RabbitMQ интеграция в .NET - exchanges, queues, bindings, MassTransit, retry, dead-letter. Активируется при rabbitmq, message queue, messaging, masstransit, publish subscribe, amqp, consumer, producer, dead-letter, saga
allowed-tools: Read, Grep, Glob
---

# RabbitMQ Patterns в .NET

## Подключение RabbitMQ

### Базовая настройка с MassTransit

```csharp
// Program.cs
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<OrderCreatedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host("rabbitmq://localhost", h =>
        {
            h.Username("guest");
            h.Password("guest");
        });

        cfg.ConfigureEndpoints(context);
    });
});
```

### Прямое использование RabbitMQ.Client

```csharp
// DI регистрация
services.AddSingleton<IConnection>(sp =>
{
    var factory = new ConnectionFactory
    {
        HostName = "localhost",
        UserName = "guest",
        Password = "guest",
        AutomaticRecoveryEnabled = true,
        NetworkRecoveryInterval = TimeSpan.FromSeconds(10)
    };
    return factory.CreateConnection();
});

services.AddSingleton<IModel>(sp =>
{
    var connection = sp.GetRequiredService<IConnection>();
    return connection.CreateModel();
});
```

## Exchange Types

### 1. Direct Exchange

```csharp
// Объявление
channel.ExchangeDeclare("orders", ExchangeType.Direct, durable: true);
channel.QueueDeclare("order.created", durable: true, exclusive: false, autoDelete: false);
channel.QueueBind("order.created", "orders", routingKey: "created");

// Публикация
var message = JsonSerializer.SerializeToUtf8Bytes(order);
channel.BasicPublish("orders", routingKey: "created", body: message);
```

### 2. Topic Exchange

```csharp
// Объявление с паттернами
channel.ExchangeDeclare("events", ExchangeType.Topic, durable: true);
channel.QueueBind("queue1", "events", routingKey: "order.*");      // order.created, order.updated
channel.QueueBind("queue2", "events", routingKey: "order.#");      // order.created.priority
channel.QueueBind("queue3", "events", routingKey: "*.created");    // order.created, product.created
```

### 3. Fanout Exchange

```csharp
// Broadcast - все очереди получают сообщение
channel.ExchangeDeclare("notifications", ExchangeType.Fanout, durable: true);
channel.QueueBind("email-queue", "notifications", routingKey: "");
channel.QueueBind("sms-queue", "notifications", routingKey: "");
channel.QueueBind("push-queue", "notifications", routingKey: "");
```

### 4. Headers Exchange

```csharp
// Роутинг по заголовкам
channel.ExchangeDeclare("documents", ExchangeType.Headers, durable: true);

var args = new Dictionary<string, object>
{
    { "x-match", "all" },           // all = AND, any = OR
    { "format", "pdf" },
    { "priority", "high" }
};
channel.QueueBind("pdf-priority-queue", "documents", "", args);
```

## MassTransit Consumers

### Базовый Consumer

```csharp
public class OrderCreatedConsumer : IConsumer<OrderCreated>
{
    private readonly ILogger<OrderCreatedConsumer> _logger;
    private readonly IOrderService _orderService;

    public OrderCreatedConsumer(ILogger<OrderCreatedConsumer> logger, IOrderService orderService)
    {
        _logger = logger;
        _orderService = orderService;
    }

    public async Task Consume(ConsumeContext<OrderCreated> context)
    {
        _logger.LogInformation("Processing order {OrderId}", context.Message.OrderId);

        await _orderService.ProcessOrderAsync(context.Message.OrderId, context.CancellationToken);
    }
}

// Сообщение
public record OrderCreated(Guid OrderId, DateTime CreatedAt, decimal Total);
```

### Публикация сообщений

```csharp
public class OrderService
{
    private readonly IPublishEndpoint _publishEndpoint;

    public async Task CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
    {
        var order = new Order(request);
        await _repository.AddAsync(order, ct);

        // Публикация события
        await _publishEndpoint.Publish(new OrderCreated(
            OrderId: order.Id,
            CreatedAt: DateTime.UtcNow,
            Total: order.Total
        ), ct);
    }
}
```

## Retry и Dead-Letter Queue

### MassTransit Retry Policy

```csharp
x.UsingRabbitMq((context, cfg) =>
{
    cfg.UseMessageRetry(r => r
        .Incremental(3, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2)));

    // Или экспоненциальный retry
    cfg.UseMessageRetry(r => r
        .Exponential(5, TimeSpan.FromSeconds(1), TimeSpan.FromMinutes(5), TimeSpan.FromSeconds(5)));

    cfg.ConfigureEndpoints(context);
});
```

### Dead-Letter Queue

```csharp
// Объявление очереди с DLX
var args = new Dictionary<string, object>
{
    { "x-dead-letter-exchange", "dlx" },
    { "x-dead-letter-routing-key", "order.failed" },
    { "x-message-ttl", 60000 }  // 60 секунд TTL
};

channel.QueueDeclare("orders", durable: true, exclusive: false, autoDelete: false, arguments: args);

// Обработка DLQ
channel.ExchangeDeclare("dlx", ExchangeType.Direct, durable: true);
channel.QueueDeclare("order.failed.queue", durable: true);
channel.QueueBind("order.failed.queue", "dlx", routingKey: "order.failed");
```

### Ручной Ack/Nack

```csharp
channel.BasicQos(prefetchSize: 0, prefetchCount: 10, global: false);

var consumer = new EventingBasicConsumer(channel);
consumer.Received += (model, ea) =>
{
    try
    {
        var message = Encoding.UTF8.GetString(ea.Body.ToArray());
        ProcessMessage(message);
        channel.BasicAck(ea.DeliveryTag, multiple: false);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to process message");
        // requeue: false - отправить в DLQ
        channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
    }
};

channel.BasicConsume("orders", autoAck: false, consumer: consumer);
```

## Saga Pattern с MassTransit

```csharp
public class OrderStateMachine : MassTransitStateMachine<OrderState>
{
    public State Submitted { get; private set; }
    public State Accepted { get; private set; }
    public State Completed { get; private set; }
    public State Faulted { get; private set; }

    public Event<OrderSubmitted> OrderSubmitted { get; private set; }
    public Event<OrderAccepted> OrderAccepted { get; private set; }
    public Event<OrderCompleted> OrderCompleted { get; private set; }
    public Event<Fault<OrderSubmitted>> OrderFaulted { get; private set; }

    public OrderStateMachine()
    {
        InstanceState(x => x.CurrentState);

        Event(() => OrderSubmitted, x => x.CorrelateById(m => m.Message.OrderId));
        Event(() => OrderAccepted, x => x.CorrelateById(m => m.Message.OrderId));

        Initially(
            When(OrderSubmitted)
                .Then(context => context.Saga.SubmittedAt = DateTime.UtcNow)
                .TransitionTo(Submitted)
                .Publish(context => new ProcessOrder(context.Message.OrderId)));

        During(Submitted,
            When(OrderAccepted)
                .TransitionTo(Accepted),
            When(OrderFaulted)
                .TransitionTo(Faulted));
    }
}
```

## Health Check

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddRabbitMQ(rabbitConnectionString: "amqp://guest:guest@localhost:5672/", name: "rabbitmq");
```

## Best Practices

### 1. Idempotency

```csharp
public class IdempotentConsumer : IConsumer<OrderCreated>
{
    private readonly IDistributedCache _cache;

    public async Task Consume(ConsumeContext<OrderCreated> context)
    {
        var messageId = context.MessageId?.ToString() ?? context.Message.OrderId.ToString();

        // Проверка дубликата
        if (await _cache.GetStringAsync(messageId) != null)
        {
            _logger.LogWarning("Duplicate message {MessageId}", messageId);
            return;
        }

        // Обработка
        await ProcessMessageAsync(context.Message);

        // Пометить как обработанное
        await _cache.SetStringAsync(messageId, "processed", new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
        });
    }
}
```

### 2. Correlation ID

```csharp
// Передача correlation ID
var props = channel.CreateBasicProperties();
props.CorrelationId = Guid.NewGuid().ToString();
props.Headers = new Dictionary<string, object>
{
    { "X-Request-Id", requestId }
};

channel.BasicPublish(exchange, routingKey, props, body);
```

### 3. Graceful Shutdown

```csharp
public class RabbitMqConsumerService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        stoppingToken.Register(() =>
        {
            _logger.LogInformation("Consumer stopping...");
            _channel.Close();
            _connection.Close();
        });

        await StartConsumingAsync(stoppingToken);
    }
}
```
