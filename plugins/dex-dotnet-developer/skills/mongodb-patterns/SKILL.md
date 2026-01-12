---
name: mongodb-patterns
description: MongoDB.Driver паттерны, индексы, aggregation, transactions. Активируется при mongodb, mongo, bson, aggregation pipeline, document database
allowed-tools: Read, Grep, Glob
---

# MongoDB Patterns для .NET

## Setup MongoDB.Driver

### Установка

```bash
dotnet add package MongoDB.Driver
```

### Конфигурация

```csharp
// appsettings.json
{
  "MongoDB": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "myapp"
  }
}

// Program.cs
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var connectionString = builder.Configuration["MongoDB:ConnectionString"];
    var settings = MongoClientSettings.FromConnectionString(connectionString);
    settings.ServerApi = new ServerApi(ServerApiVersion.V1);
    return new MongoClient(settings);
});

builder.Services.AddScoped<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    return client.GetDatabase(builder.Configuration["MongoDB:DatabaseName"]);
});
```

## Entity Mapping

### BSON Attributes

```csharp
[BsonCollection("orders")]
public class Order
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("customerId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CustomerId { get; set; } = null!;

    [BsonElement("items")]
    public List<OrderItem> Items { get; set; } = new();

    [BsonElement("total")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Total { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public OrderStatus Status { get; set; }

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; }

    [BsonIgnoreIfNull]
    [BsonElement("completedAt")]
    public DateTime? CompletedAt { get; set; }

    [BsonExtraElements]
    public BsonDocument? ExtraElements { get; set; }
}

public class OrderItem
{
    [BsonElement("productId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ProductId { get; set; } = null!;

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("price")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Price { get; set; }
}
```

### Convention Pack

```csharp
// Глобальная конвенция для camelCase
var conventionPack = new ConventionPack
{
    new CamelCaseElementNameConvention(),
    new IgnoreExtraElementsConvention(true),
    new EnumRepresentationConvention(BsonType.String)
};
ConventionRegistry.Register("MyConventions", conventionPack, _ => true);
```

## Repository Pattern

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> filter, CancellationToken ct = default);
    Task CreateAsync(T entity, CancellationToken ct = default);
    Task UpdateAsync(string id, T entity, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public class MongoRepository<T> : IRepository<T> where T : class
{
    private readonly IMongoCollection<T> _collection;

    public MongoRepository(IMongoDatabase database)
    {
        var collectionName = typeof(T).GetCustomAttribute<BsonCollectionAttribute>()?.CollectionName
            ?? typeof(T).Name.ToLower() + "s";
        _collection = database.GetCollection<T>(collectionName);
    }

    public async Task<T?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var filter = Builders<T>.Filter.Eq("_id", ObjectId.Parse(id));
        return await _collection.Find(filter).FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<T>> FindAsync(
        Expression<Func<T, bool>> filter,
        CancellationToken ct = default)
    {
        return await _collection.Find(filter).ToListAsync(ct);
    }

    public async Task CreateAsync(T entity, CancellationToken ct = default)
    {
        await _collection.InsertOneAsync(entity, cancellationToken: ct);
    }

    public async Task UpdateAsync(string id, T entity, CancellationToken ct = default)
    {
        var filter = Builders<T>.Filter.Eq("_id", ObjectId.Parse(id));
        await _collection.ReplaceOneAsync(filter, entity, cancellationToken: ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var filter = Builders<T>.Filter.Eq("_id", ObjectId.Parse(id));
        await _collection.DeleteOneAsync(filter, ct);
    }
}
```

## Query Patterns

### Builders

```csharp
// Filter Builder
var filter = Builders<Order>.Filter.And(
    Builders<Order>.Filter.Eq(o => o.Status, OrderStatus.Pending),
    Builders<Order>.Filter.Gte(o => o.Total, 100),
    Builders<Order>.Filter.ElemMatch(o => o.Items, i => i.Quantity > 5)
);

// Sort Builder
var sort = Builders<Order>.Sort
    .Descending(o => o.CreatedAt)
    .Ascending(o => o.Total);

// Projection Builder
var projection = Builders<Order>.Projection
    .Include(o => o.Id)
    .Include(o => o.Total)
    .Include(o => o.Status)
    .Exclude(o => o.Items);

// Update Builder
var update = Builders<Order>.Update
    .Set(o => o.Status, OrderStatus.Completed)
    .Set(o => o.CompletedAt, DateTime.UtcNow)
    .Inc(o => o.Total, 10);

// Выполнение
var orders = await _collection
    .Find(filter)
    .Sort(sort)
    .Project<OrderSummary>(projection)
    .Skip(20)
    .Limit(10)
    .ToListAsync(ct);
```

### Text Search

```csharp
// Создание text index
await _collection.Indexes.CreateOneAsync(
    new CreateIndexModel<Product>(
        Builders<Product>.IndexKeys.Text(p => p.Name).Text(p => p.Description)));

// Поиск
var filter = Builders<Product>.Filter.Text("gaming laptop");
var results = await _collection.Find(filter).ToListAsync(ct);
```

## Aggregation Pipeline

```csharp
// Группировка заказов по месяцам
var pipeline = new[]
{
    // Match - фильтрация
    new BsonDocument("$match", new BsonDocument
    {
        { "status", "completed" },
        { "createdAt", new BsonDocument("$gte", new DateTime(2024, 1, 1)) }
    }),

    // Group - группировка по месяцу
    new BsonDocument("$group", new BsonDocument
    {
        { "_id", new BsonDocument
            {
                { "year", new BsonDocument("$year", "$createdAt") },
                { "month", new BsonDocument("$month", "$createdAt") }
            }
        },
        { "totalOrders", new BsonDocument("$sum", 1) },
        { "totalRevenue", new BsonDocument("$sum", "$total") },
        { "avgOrderValue", new BsonDocument("$avg", "$total") }
    }),

    // Sort
    new BsonDocument("$sort", new BsonDocument("_id", -1)),

    // Limit
    new BsonDocument("$limit", 12)
};

var results = await _collection.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);

// Typed Aggregation
var results = await _collection.Aggregate()
    .Match(o => o.Status == OrderStatus.Completed)
    .Group(
        o => new { o.CreatedAt.Year, o.CreatedAt.Month },
        g => new
        {
            Year = g.Key.Year,
            Month = g.Key.Month,
            TotalOrders = g.Count(),
            TotalRevenue = g.Sum(o => o.Total)
        })
    .SortByDescending(r => r.Year)
    .ThenByDescending(r => r.Month)
    .ToListAsync(ct);
```

## Index Management

```csharp
public static class OrderIndexes
{
    public static async Task CreateIndexesAsync(IMongoCollection<Order> collection)
    {
        var indexes = new List<CreateIndexModel<Order>>
        {
            // Single field index
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(o => o.CustomerId),
                new CreateIndexOptions { Name = "customer_id_idx" }),

            // Compound index
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys
                    .Ascending(o => o.Status)
                    .Descending(o => o.CreatedAt),
                new CreateIndexOptions { Name = "status_date_idx" }),

            // TTL index (auto-delete после 30 дней)
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(o => o.CreatedAt),
                new CreateIndexOptions
                {
                    Name = "ttl_idx",
                    ExpireAfter = TimeSpan.FromDays(30)
                }),

            // Unique index
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending("orderNumber"),
                new CreateIndexOptions { Name = "order_number_unique", Unique = true })
        };

        await collection.Indexes.CreateManyAsync(indexes);
    }
}
```

## Transactions

```csharp
public class OrderService
{
    private readonly IMongoClient _client;
    private readonly IMongoCollection<Order> _orders;
    private readonly IMongoCollection<Product> _products;

    public async Task<Order> CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
    {
        using var session = await _client.StartSessionAsync(cancellationToken: ct);

        session.StartTransaction(new TransactionOptions(
            readConcern: ReadConcern.Majority,
            writeConcern: WriteConcern.WMajority));

        try
        {
            // Проверить и уменьшить количество товара
            foreach (var item in request.Items)
            {
                var result = await _products.UpdateOneAsync(
                    session,
                    p => p.Id == item.ProductId && p.Stock >= item.Quantity,
                    Builders<Product>.Update.Inc(p => p.Stock, -item.Quantity),
                    cancellationToken: ct);

                if (result.ModifiedCount == 0)
                    throw new InsufficientStockException(item.ProductId);
            }

            // Создать заказ
            var order = new Order { /* ... */ };
            await _orders.InsertOneAsync(session, order, cancellationToken: ct);

            await session.CommitTransactionAsync(ct);
            return order;
        }
        catch
        {
            await session.AbortTransactionAsync(ct);
            throw;
        }
    }
}
```

## Change Streams

```csharp
public class OrderChangeStreamService : BackgroundService
{
    private readonly IMongoCollection<Order> _collection;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var pipeline = new EmptyPipelineDefinition<ChangeStreamDocument<Order>>()
            .Match(change =>
                change.OperationType == ChangeStreamOperationType.Insert ||
                change.OperationType == ChangeStreamOperationType.Update);

        using var cursor = await _collection.WatchAsync(pipeline, cancellationToken: ct);

        await foreach (var change in cursor.ToAsyncEnumerable(ct))
        {
            switch (change.OperationType)
            {
                case ChangeStreamOperationType.Insert:
                    await HandleNewOrder(change.FullDocument, ct);
                    break;
                case ChangeStreamOperationType.Update:
                    await HandleOrderUpdate(change.DocumentKey, change.UpdateDescription, ct);
                    break;
            }
        }
    }
}
```

## Best Practices

1. **Индексы**
   - Создавайте индексы для всех полей в фильтрах
   - Используйте compound indexes для частых запросов
   - Следуйте ESR rule: Equality, Sort, Range

2. **Schema Design**
   - Embed для данных, которые читаются вместе
   - Reference для больших или часто меняющихся данных
   - Избегайте unbounded arrays

3. **Performance**
   - Используйте projection для уменьшения передаваемых данных
   - Избегайте $where и regex без индекса
   - Используйте bulk operations для массовых операций

4. **Transactions**
   - Используйте только когда необходимо
   - Держите транзакции короткими
   - Replica Set обязателен для транзакций
