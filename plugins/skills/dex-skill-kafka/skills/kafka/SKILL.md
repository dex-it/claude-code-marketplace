---
name: kafka-patterns
description: Apache Kafka в .NET - Confluent.Kafka, producers, consumers, consumer groups, partitions, Schema Registry, MassTransit Kafka. Активируется при kafka, kafka producer, kafka consumer, confluent, topic, partition, consumer group, offset, schema registry, avro, protobuf, ksql, event streaming
allowed-tools: Read, Grep, Glob
---

# Kafka Patterns в .NET

## Confluent.Kafka Configuration

### Producer Setup

```csharp
// Базовая конфигурация Producer
var config = new ProducerConfig
{
    BootstrapServers = "localhost:9092",
    ClientId = "my-producer",
    Acks = Acks.All,                    // Ждать подтверждения от всех реплик
    EnableIdempotence = true,           // Idempotent producer
    MaxInFlight = 5,                    // Max requests in flight
    MessageSendMaxRetries = 3,
    RetryBackoffMs = 100,
    LingerMs = 5,                       // Batch delay
    BatchSize = 16384,                  // Batch size in bytes
    CompressionType = CompressionType.Snappy
};

// SASL/SSL Configuration
var secureConfig = new ProducerConfig
{
    BootstrapServers = "kafka.example.com:9093",
    SecurityProtocol = SecurityProtocol.SaslSsl,
    SaslMechanism = SaslMechanism.ScramSha256,
    SaslUsername = "user",
    SaslPassword = "password",
    SslCaLocation = "/path/to/ca.crt"
};
```

### Consumer Setup

```csharp
var config = new ConsumerConfig
{
    BootstrapServers = "localhost:9092",
    GroupId = "my-consumer-group",
    ClientId = "my-consumer",
    AutoOffsetReset = AutoOffsetReset.Earliest,
    EnableAutoCommit = false,           // Manual commit для exactly-once
    EnableAutoOffsetStore = false,
    MaxPollIntervalMs = 300000,
    SessionTimeoutMs = 45000,
    HeartbeatIntervalMs = 3000,
    FetchMinBytes = 1,
    FetchMaxBytes = 52428800,           // 50MB
    MaxPartitionFetchBytes = 1048576    // 1MB
};
```

## Producer Patterns

### Sync Producer

```csharp
public class KafkaProducer<TKey, TValue> : IDisposable
{
    private readonly IProducer<TKey, TValue> _producer;

    public KafkaProducer(ProducerConfig config)
    {
        _producer = new ProducerBuilder<TKey, TValue>(config)
            .SetErrorHandler((_, error) =>
                Console.WriteLine($"Kafka error: {error.Reason}"))
            .SetLogHandler((_, log) =>
                Console.WriteLine($"Kafka log: {log.Message}"))
            .Build();
    }

    public async Task<DeliveryResult<TKey, TValue>> ProduceAsync(
        string topic, TKey key, TValue value, CancellationToken ct = default)
    {
        var message = new Message<TKey, TValue>
        {
            Key = key,
            Value = value,
            Headers = new Headers
            {
                { "correlation-id", Encoding.UTF8.GetBytes(Guid.NewGuid().ToString()) },
                { "timestamp", Encoding.UTF8.GetBytes(DateTime.UtcNow.ToString("O")) }
            }
        };

        return await _producer.ProduceAsync(topic, message, ct);
    }

    public void Dispose() => _producer?.Dispose();
}
```

### Fire-and-Forget с Callback

```csharp
// Высокая пропускная способность, без ожидания
_producer.Produce(topic, message, deliveryReport =>
{
    if (deliveryReport.Error.Code != ErrorCode.NoError)
    {
        _logger.LogError("Delivery failed: {Error}", deliveryReport.Error.Reason);
    }
    else
    {
        _logger.LogDebug("Delivered to {Topic}[{Partition}]@{Offset}",
            deliveryReport.Topic,
            deliveryReport.Partition,
            deliveryReport.Offset);
    }
});

// Flush перед завершением
_producer.Flush(TimeSpan.FromSeconds(10));
```

### Transactional Producer

```csharp
var config = new ProducerConfig
{
    BootstrapServers = "localhost:9092",
    TransactionalId = "my-transactional-id",
    EnableIdempotence = true
};

using var producer = new ProducerBuilder<string, string>(config).Build();

producer.InitTransactions(TimeSpan.FromSeconds(30));

try
{
    producer.BeginTransaction();

    await producer.ProduceAsync("topic1", new Message<string, string>
    {
        Key = "key1",
        Value = "value1"
    });

    await producer.ProduceAsync("topic2", new Message<string, string>
    {
        Key = "key2",
        Value = "value2"
    });

    producer.CommitTransaction();
}
catch (Exception ex)
{
    producer.AbortTransaction();
    throw;
}
```

## Consumer Patterns

### Basic Consumer Loop

```csharp
public class KafkaConsumer<TKey, TValue> : BackgroundService
{
    private readonly IConsumer<TKey, TValue> _consumer;
    private readonly string _topic;
    private readonly ILogger _logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _consumer.Subscribe(_topic);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var result = _consumer.Consume(stoppingToken);

                if (result?.Message == null) continue;

                try
                {
                    await ProcessMessageAsync(result, stoppingToken);

                    // Manual commit after successful processing
                    _consumer.Commit(result);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message");
                    // Не коммитим - сообщение будет переобработано
                }
            }
        }
        finally
        {
            _consumer.Close();
        }
    }

    private async Task ProcessMessageAsync(
        ConsumeResult<TKey, TValue> result, CancellationToken ct)
    {
        _logger.LogInformation(
            "Processing message from {Topic}[{Partition}]@{Offset}",
            result.Topic, result.Partition.Value, result.Offset.Value);

        // Processing logic here
    }
}
```

### Batch Consumer

```csharp
public async Task ConsumeBatchAsync(CancellationToken ct)
{
    var batch = new List<ConsumeResult<string, string>>();
    var batchSize = 100;
    var batchTimeout = TimeSpan.FromSeconds(5);
    var batchStart = DateTime.UtcNow;

    while (!ct.IsCancellationRequested)
    {
        var result = _consumer.Consume(TimeSpan.FromMilliseconds(100));

        if (result != null)
        {
            batch.Add(result);
        }

        var shouldProcess = batch.Count >= batchSize ||
            (batch.Count > 0 && DateTime.UtcNow - batchStart > batchTimeout);

        if (shouldProcess)
        {
            await ProcessBatchAsync(batch, ct);

            // Commit highest offset
            _consumer.Commit(batch.Last());

            batch.Clear();
            batchStart = DateTime.UtcNow;
        }
    }
}
```

### Consumer с Partition Assignment

```csharp
var consumer = new ConsumerBuilder<string, string>(config)
    .SetPartitionsAssignedHandler((c, partitions) =>
    {
        _logger.LogInformation("Assigned partitions: {Partitions}",
            string.Join(", ", partitions.Select(p => $"{p.Topic}[{p.Partition}]")));
    })
    .SetPartitionsRevokedHandler((c, partitions) =>
    {
        _logger.LogInformation("Revoked partitions: {Partitions}",
            string.Join(", ", partitions.Select(p => $"{p.Topic}[{p.Partition}]")));

        // Commit before rebalance
        c.Commit();
    })
    .SetPartitionsLostHandler((c, partitions) =>
    {
        _logger.LogWarning("Lost partitions: {Partitions}",
            string.Join(", ", partitions.Select(p => $"{p.Topic}[{p.Partition}]")));
    })
    .Build();
```

## Schema Registry Integration

### Avro Serialization

```csharp
// NuGet: Confluent.SchemaRegistry.Serdes.Avro

var schemaRegistryConfig = new SchemaRegistryConfig
{
    Url = "http://localhost:8081"
};

var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);

var producerConfig = new ProducerConfig { BootstrapServers = "localhost:9092" };

using var producer = new ProducerBuilder<string, MyAvroMessage>(producerConfig)
    .SetValueSerializer(new AvroSerializer<MyAvroMessage>(schemaRegistry))
    .Build();

// Consumer
using var consumer = new ConsumerBuilder<string, MyAvroMessage>(consumerConfig)
    .SetValueDeserializer(new AvroDeserializer<MyAvroMessage>(schemaRegistry))
    .Build();
```

### Protobuf Serialization

```csharp
// NuGet: Confluent.SchemaRegistry.Serdes.Protobuf

using var producer = new ProducerBuilder<string, MyProtoMessage>(producerConfig)
    .SetValueSerializer(new ProtobufSerializer<MyProtoMessage>(schemaRegistry))
    .Build();

using var consumer = new ConsumerBuilder<string, MyProtoMessage>(consumerConfig)
    .SetValueDeserializer(new ProtobufDeserializer<MyProtoMessage>())
    .Build();
```

### JSON Schema

```csharp
// NuGet: Confluent.SchemaRegistry.Serdes.Json

var jsonSerializerConfig = new JsonSerializerConfig
{
    AutoRegisterSchemas = true,
    SubjectNameStrategy = SubjectNameStrategy.TopicRecord
};

using var producer = new ProducerBuilder<string, MyJsonMessage>(producerConfig)
    .SetValueSerializer(new JsonSerializer<MyJsonMessage>(schemaRegistry, jsonSerializerConfig))
    .Build();
```

## MassTransit Kafka Transport

### Configuration

```csharp
services.AddMassTransit(x =>
{
    x.UsingInMemory(); // Or другой транспорт для saga/scheduling

    x.AddRider(rider =>
    {
        rider.AddConsumer<OrderCreatedConsumer>();
        rider.AddProducer<OrderCreated>("orders-topic");

        rider.UsingKafka((context, k) =>
        {
            k.Host("localhost:9092");

            k.TopicEndpoint<OrderCreated>("orders-topic", "order-consumer-group", e =>
            {
                e.ConfigureConsumer<OrderCreatedConsumer>(context);
                e.AutoOffsetReset = AutoOffsetReset.Earliest;
            });
        });
    });
});
```

### Producer с MassTransit

```csharp
public class OrderService
{
    private readonly ITopicProducer<OrderCreated> _producer;

    public OrderService(ITopicProducer<OrderCreated> producer)
    {
        _producer = producer;
    }

    public async Task CreateOrderAsync(Order order)
    {
        await _producer.Produce(new OrderCreated
        {
            OrderId = order.Id,
            CustomerId = order.CustomerId,
            Total = order.Total
        });
    }
}
```

### Consumer с MassTransit

```csharp
public class OrderCreatedConsumer : IConsumer<OrderCreated>
{
    private readonly ILogger<OrderCreatedConsumer> _logger;

    public async Task Consume(ConsumeContext<OrderCreated> context)
    {
        _logger.LogInformation("Order created: {OrderId}", context.Message.OrderId);

        // Processing logic
    }
}
```

## Error Handling и Retry

### Dead Letter Topic Pattern

```csharp
public async Task ConsumeWithDLTAsync(CancellationToken ct)
{
    const int maxRetries = 3;

    while (!ct.IsCancellationRequested)
    {
        var result = _consumer.Consume(ct);

        var retryCount = GetRetryCount(result.Message.Headers);

        try
        {
            await ProcessMessageAsync(result, ct);
            _consumer.Commit(result);
        }
        catch (Exception ex)
        {
            if (retryCount >= maxRetries)
            {
                // Send to DLT
                await _dlqProducer.ProduceAsync(
                    $"{result.Topic}.DLT",
                    result.Message.Key,
                    result.Message.Value);

                _consumer.Commit(result);
                _logger.LogError(ex, "Message sent to DLT after {Retries} retries", retryCount);
            }
            else
            {
                // Republish with incremented retry count
                await RepublishWithRetryAsync(result, retryCount + 1);
                _consumer.Commit(result);
            }
        }
    }
}
```

### Exponential Backoff

```csharp
public async Task<T> ExecuteWithRetryAsync<T>(
    Func<Task<T>> action,
    int maxRetries = 3,
    int baseDelayMs = 100)
{
    for (int i = 0; i <= maxRetries; i++)
    {
        try
        {
            return await action();
        }
        catch (KafkaException ex) when (ex.Error.IsFatal == false && i < maxRetries)
        {
            var delay = baseDelayMs * Math.Pow(2, i);
            await Task.Delay((int)delay);
        }
    }

    throw new Exception("Max retries exceeded");
}
```

## Health Checks

### Kafka Health Check

```csharp
// NuGet: AspNetCore.HealthChecks.Kafka

services.AddHealthChecks()
    .AddKafka(new ProducerConfig
    {
        BootstrapServers = "localhost:9092"
    },
    topic: "health-check-topic",
    name: "kafka",
    tags: new[] { "messaging", "kafka" });
```

### Custom Health Check

```csharp
public class KafkaHealthCheck : IHealthCheck
{
    private readonly IAdminClient _adminClient;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken ct = default)
    {
        try
        {
            var metadata = _adminClient.GetMetadata(TimeSpan.FromSeconds(5));

            return HealthCheckResult.Healthy(
                $"Connected to {metadata.Brokers.Count} brokers");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Kafka unavailable", ex);
        }
    }
}
```

## Admin Operations

### Topic Management

```csharp
var adminConfig = new AdminClientConfig
{
    BootstrapServers = "localhost:9092"
};

using var adminClient = new AdminClientBuilder(adminConfig).Build();

// Create topic
await adminClient.CreateTopicsAsync(new[]
{
    new TopicSpecification
    {
        Name = "my-topic",
        NumPartitions = 6,
        ReplicationFactor = 3,
        Configs = new Dictionary<string, string>
        {
            { "retention.ms", "604800000" },  // 7 days
            { "cleanup.policy", "delete" }
        }
    }
});

// Delete topic
await adminClient.DeleteTopicsAsync(new[] { "my-topic" });

// Get metadata
var metadata = adminClient.GetMetadata(TimeSpan.FromSeconds(10));
foreach (var topic in metadata.Topics)
{
    Console.WriteLine($"Topic: {topic.Topic}, Partitions: {topic.Partitions.Count}");
}
```

## Best Practices

### Producer
- Используй `EnableIdempotence = true` для exactly-once semantics
- Всегда устанавливай `Acks = All` для критичных данных
- Используй compression (Snappy, LZ4) для высокой пропускной способности
- Batch messages с `LingerMs` и `BatchSize`
- Обязательно вызывай `Flush()` перед shutdown

### Consumer
- Используй `EnableAutoCommit = false` для manual offset management
- Обрабатывай rebalance через handlers
- Implement idempotency на стороне consumer
- Используй batch processing для throughput
- Monitor consumer lag

### General
- Используй Schema Registry для schema evolution
- Implement Dead Letter Topic для failed messages
- Monitor с Prometheus/Grafana
- Используй meaningful partition keys
- Configure proper retention policies
