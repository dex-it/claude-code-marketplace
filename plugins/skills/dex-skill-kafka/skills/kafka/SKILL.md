---
name: kafka-patterns
description: Kafka — producers, consumers, exactly-once, ловушки. Активируется при kafka, producer, consumer, topic, partition, offset, consumer group, schema registry
allowed-tools: Read, Grep, Glob
---

# Kafka Patterns

## Правила

- `EnableIdempotence = true` + `Acks = All` для critical data
- `EnableAutoCommit = false` — manual commit после обработки
- Partition key = business key (OrderId, CustomerId) — гарантирует порядок
- Dead Letter Topic для failed messages
- Schema Registry для schema evolution
- `Flush()` перед shutdown producer

## Анти-паттерны

```csharp
// Плохо — auto commit → потеря при crash
var config = new ConsumerConfig
{
    EnableAutoCommit = true,  // commit ПЕРЕД обработкой
    // consumer crash после commit, но до обработки → сообщение потеряно
};

// Хорошо — manual commit ПОСЛЕ обработки
var config = new ConsumerConfig
{
    EnableAutoCommit = false,
    EnableAutoOffsetStore = false,
};
// ...
await ProcessMessageAsync(result, ct);
_consumer.Commit(result); // commit только после успешной обработки

// Плохо — random partition key → нет гарантии порядка
await _producer.ProduceAsync("orders", new Message<string, string>
{
    Key = Guid.NewGuid().ToString(), // каждый раз разный ключ
    Value = json
});
// Сообщения одного заказа могут оказаться в разных partitions → нет порядка

// Хорошо — business key как partition key
await _producer.ProduceAsync("orders", new Message<string, string>
{
    Key = order.Id.ToString(), // все events одного заказа → одна partition → порядок
    Value = json
});

// Плохо — fire-and-forget без callback
_producer.Produce("topic", message); // ошибка доставки теряется молча

// Хорошо — callback для отслеживания delivery
_producer.Produce("topic", message, report =>
{
    if (report.Error.Code != ErrorCode.NoError)
        _logger.LogError("Delivery failed: {Error}", report.Error.Reason);
});

// Плохо — consumer не обрабатывает rebalance
var consumer = new ConsumerBuilder<string, string>(config).Build();
// при rebalance uncommitted offsets теряются → повторная обработка

// Хорошо — commit при rebalance
var consumer = new ConsumerBuilder<string, string>(config)
    .SetPartitionsRevokedHandler((c, partitions) =>
    {
        c.Commit(); // commit перед потерей partitions
    })
    .Build();
```

## Consumer patterns

### Basic loop

```csharp
while (!ct.IsCancellationRequested)
{
    var result = _consumer.Consume(ct);
    if (result?.Message == null) continue;

    try
    {
        await ProcessMessageAsync(result, ct);
        _consumer.Commit(result);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed processing {Topic}[{Partition}]@{Offset}",
            result.Topic, result.Partition.Value, result.Offset.Value);
        // НЕ commit → retry при следующем poll
        // или: отправить в DLT после N retries
    }
}
```

### Batch consumer (high throughput)

```csharp
var batch = new List<ConsumeResult<string, string>>();
while (!ct.IsCancellationRequested)
{
    var result = _consumer.Consume(TimeSpan.FromMilliseconds(100));
    if (result != null) batch.Add(result);

    if (batch.Count >= 100 || (batch.Count > 0 && timeout))
    {
        await ProcessBatchAsync(batch, ct);
        _consumer.Commit(batch.Last());
        batch.Clear();
    }
}
```

## Kafka vs RabbitMQ — когда что

| Критерий | Kafka | RabbitMQ |
|----------|-------|----------|
| Throughput | Миллионы msg/sec | Тысячи msg/sec |
| Retention | Хранит N дней (replay) | Удаляет после ACK |
| Ordering | Per-partition | Per-queue |
| Pattern | Event log, streaming | Task queue, RPC |
| Consumer groups | Встроено | Нет (ручная балансировка) |

## Чек-лист

- [ ] `EnableIdempotence = true` на producer
- [ ] `Acks = All` для critical data
- [ ] Manual commit после обработки
- [ ] Business key как partition key
- [ ] Rebalance handler с commit
- [ ] DLT для failed messages
- [ ] `Flush()` при shutdown
- [ ] Schema Registry для production
