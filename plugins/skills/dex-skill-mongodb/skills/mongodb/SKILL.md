---
name: mongodb-patterns
description: MongoDB — schema design, индексы, aggregation, ловушки. Активируется при mongodb, mongo, bson, aggregation pipeline, document database
allowed-tools: Read, Grep, Glob
---

# MongoDB Patterns

## Правила

- MongoClient — Singleton (connection pool внутри)
- Embed для данных, которые читаются вместе
- Reference (по ID) для больших или часто меняющихся данных
- Не используй unbounded arrays — документ > 16MB = crash
- Индексы на все поля в фильтрах, ESR rule: Equality → Sort → Range
- Transactions только при необходимости (Replica Set обязателен)
- Convention Pack для camelCase + IgnoreExtraElements

## Анти-паттерны

```csharp
// Плохо — new MongoClient на каждый запрос (утечка connections)
public async Task DoWork()
{
    var client = new MongoClient("mongodb://localhost"); // каждый раз новый!
    var db = client.GetDatabase("myapp");
}

// Плохо — unbounded array → документ растёт бесконечно
public class User
{
    public List<LogEntry> ActivityLog { get; set; } = new(); // миллионы записей!
}
// Документ > 16MB → MongoBulkWriteException

// Хорошо — отдельная коллекция для unbounded data
public class ActivityLog
{
    public string UserId { get; set; }
    public DateTime Timestamp { get; set; }
    public string Action { get; set; }
}

// Плохо — запрос без индекса → collection scan
await _collection.Find(o => o.Status == "pending" && o.CreatedAt > cutoff).ToListAsync(ct);
// MongoDB сканирует ВСЮ коллекцию

// Хорошо — compound index по ESR rule
await _collection.Indexes.CreateOneAsync(new CreateIndexModel<Order>(
    Builders<Order>.IndexKeys
        .Ascending(o => o.Status)       // Equality first
        .Descending(o => o.CreatedAt),  // Sort/Range last
    new CreateIndexOptions { Name = "status_date_idx" }));

// Плохо — читаем весь документ для одного поля
var orders = await _collection.Find(filter).ToListAsync(ct);
var ids = orders.Select(o => o.Id);

// Хорошо — projection
var ids = await _collection.Find(filter)
    .Project(Builders<Order>.Projection.Include(o => o.Id))
    .ToListAsync(ct);
```

## Embed vs Reference

| Критерий | Embed | Reference |
|----------|-------|-----------|
| Читается вместе | Да → embed | Нет → reference |
| Размер вложенных данных | Маленький, bounded | Большой, unbounded |
| Частота обновлений | Редко | Часто |
| Нужна целостность | Eventual OK | Нужна транзакция |

```csharp
// Embed — адрес внутри заказа (всегда читается вместе)
public class Order
{
    public Address ShippingAddress { get; set; } // embed
    public List<OrderItem> Items { get; set; }   // embed (bounded, max ~100)
}

// Reference — пользователь в заказе (часто меняется, читается отдельно)
public class Order
{
    public string CustomerId { get; set; } // reference by ID, не embed User
}
```

## TTL Index — auto cleanup

```csharp
// Автоматическое удаление через 30 дней — не пиши cron job
await _collection.Indexes.CreateOneAsync(new CreateIndexModel<AuditLog>(
    Builders<AuditLog>.IndexKeys.Ascending(l => l.CreatedAt),
    new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(30) }));
```

## Change Streams — вместо polling

```csharp
// Плохо — polling каждые N секунд
while (true)
{
    var newOrders = await _collection.Find(o => o.Status == "new").ToListAsync(ct);
    await Task.Delay(5000, ct); // 5 сек задержка + лишние запросы
}

// Хорошо — реактивно через Change Streams
using var cursor = await _collection.WatchAsync(
    new EmptyPipelineDefinition<ChangeStreamDocument<Order>>()
        .Match(c => c.OperationType == ChangeStreamOperationType.Insert),
    cancellationToken: ct);

await foreach (var change in cursor.ToAsyncEnumerable(ct))
{
    await HandleNewOrder(change.FullDocument, ct);
}
```

## Чек-лист

- [ ] MongoClient — Singleton
- [ ] Нет unbounded arrays в документах
- [ ] Индексы на поля в фильтрах (ESR rule)
- [ ] Projection для частичного чтения
- [ ] Embed для co-read data, Reference для independent
- [ ] TTL index для auto-cleanup
- [ ] Transactions только при необходимости
- [ ] IgnoreExtraElements convention (обратная совместимость)
