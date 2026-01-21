---
name: redis-patterns
description: Redis в .NET - StackExchange.Redis, кэширование, distributed lock, pub/sub, сессии. Активируется при redis, cache, caching, distributed cache, session, pub sub, lock, rate limit, StackExchange
allowed-tools: Read, Grep, Glob
---

# Redis Patterns в .NET

## Подключение

### StackExchange.Redis

```csharp
// Program.cs
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var config = ConfigurationOptions.Parse("localhost:6379");
    config.AbortOnConnectFail = false;
    config.ConnectRetry = 3;
    config.ConnectTimeout = 5000;
    config.Password = "password";
    return ConnectionMultiplexer.Connect(config);
});

builder.Services.AddScoped<IDatabase>(sp =>
{
    var multiplexer = sp.GetRequiredService<IConnectionMultiplexer>();
    return multiplexer.GetDatabase();
});
```

### IDistributedCache

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
    options.InstanceName = "MyApp_";
});
```

## Кэширование

### Базовые операции

```csharp
public class RedisCacheService
{
    private readonly IDatabase _db;
    private readonly JsonSerializerOptions _jsonOptions;

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>(value!, _jsonOptions);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value, _jsonOptions);
        await _db.StringSetAsync(key, json, expiry);
    }

    public async Task<bool> DeleteAsync(string key, CancellationToken ct = default)
    {
        return await _db.KeyDeleteAsync(key);
    }
}
```

### Cache-Aside Pattern

```csharp
public class ProductService
{
    private readonly IDatabase _cache;
    private readonly IProductRepository _repository;
    private readonly TimeSpan _cacheExpiry = TimeSpan.FromMinutes(30);

    public async Task<Product?> GetProductAsync(int id, CancellationToken ct)
    {
        var cacheKey = $"product:{id}";

        // 1. Попытка из кэша
        var cached = await _cache.StringGetAsync(cacheKey);
        if (!cached.IsNullOrEmpty)
        {
            return JsonSerializer.Deserialize<Product>(cached!);
        }

        // 2. Из БД
        var product = await _repository.GetByIdAsync(id, ct);
        if (product == null) return null;

        // 3. Сохранить в кэш
        var json = JsonSerializer.Serialize(product);
        await _cache.StringSetAsync(cacheKey, json, _cacheExpiry);

        return product;
    }

    public async Task InvalidateProductAsync(int id)
    {
        await _cache.KeyDeleteAsync($"product:{id}");
    }
}
```

### IDistributedCache Pattern

```csharp
public class CachedProductService
{
    private readonly IDistributedCache _cache;
    private readonly IProductRepository _repository;

    public async Task<Product?> GetProductAsync(int id, CancellationToken ct)
    {
        var cacheKey = $"product:{id}";

        var cached = await _cache.GetStringAsync(cacheKey, ct);
        if (cached != null)
        {
            return JsonSerializer.Deserialize<Product>(cached);
        }

        var product = await _repository.GetByIdAsync(id, ct);
        if (product == null) return null;

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(product),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
                SlidingExpiration = TimeSpan.FromMinutes(10)
            }, ct);

        return product;
    }
}
```

## Distributed Lock

### RedLock Pattern

```csharp
public class DistributedLockService
{
    private readonly IDatabase _db;
    private readonly string _lockToken;

    public DistributedLockService(IDatabase db)
    {
        _db = db;
        _lockToken = Guid.NewGuid().ToString();
    }

    public async Task<bool> AcquireLockAsync(string resource, TimeSpan expiry)
    {
        var lockKey = $"lock:{resource}";
        return await _db.StringSetAsync(lockKey, _lockToken, expiry, When.NotExists);
    }

    public async Task<bool> ReleaseLockAsync(string resource)
    {
        var lockKey = $"lock:{resource}";

        // Lua script для атомарного освобождения
        var script = @"
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end";

        var result = await _db.ScriptEvaluateAsync(script,
            new RedisKey[] { lockKey },
            new RedisValue[] { _lockToken });

        return (long)result == 1;
    }

    public async Task<T> WithLockAsync<T>(string resource, TimeSpan lockExpiry, Func<Task<T>> action)
    {
        if (!await AcquireLockAsync(resource, lockExpiry))
        {
            throw new InvalidOperationException($"Cannot acquire lock for {resource}");
        }

        try
        {
            return await action();
        }
        finally
        {
            await ReleaseLockAsync(resource);
        }
    }
}

// Использование
await lockService.WithLockAsync("order:123", TimeSpan.FromSeconds(30), async () =>
{
    await ProcessOrderAsync(123);
    return true;
});
```

### С использованием RedLock.net

```csharp
// NuGet: RedLock.net
services.AddSingleton<IDistributedLockFactory>(sp =>
{
    var multiplexer = sp.GetRequiredService<IConnectionMultiplexer>();
    return RedLockFactory.Create(new List<RedLockMultiplexer>
    {
        new RedLockMultiplexer(multiplexer)
    });
});

// Использование
await using var redLock = await _lockFactory.CreateLockAsync(
    resource: "order:123",
    expiryTime: TimeSpan.FromSeconds(30));

if (redLock.IsAcquired)
{
    await ProcessOrderAsync(123);
}
```

## Pub/Sub

### Publisher

```csharp
public class RedisMessagePublisher
{
    private readonly ISubscriber _subscriber;

    public RedisMessagePublisher(IConnectionMultiplexer multiplexer)
    {
        _subscriber = multiplexer.GetSubscriber();
    }

    public async Task PublishAsync<T>(string channel, T message)
    {
        var json = JsonSerializer.Serialize(message);
        await _subscriber.PublishAsync(channel, json);
    }
}
```

### Subscriber

```csharp
public class RedisMessageSubscriber : BackgroundService
{
    private readonly ISubscriber _subscriber;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RedisMessageSubscriber> _logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _subscriber.SubscribeAsync("orders:*", async (channel, message) =>
        {
            _logger.LogInformation("Received message on {Channel}: {Message}", channel, message);

            using var scope = _scopeFactory.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<IMessageHandler>();
            await handler.HandleAsync(channel, message);
        });

        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
```

## Session Storage

```csharp
// Program.cs
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
    options.InstanceName = "Session_";
});

// Использование
public class CartController : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> AddToCart(AddToCartRequest request)
    {
        var cart = HttpContext.Session.GetString("cart");
        var cartItems = string.IsNullOrEmpty(cart)
            ? new List<CartItem>()
            : JsonSerializer.Deserialize<List<CartItem>>(cart);

        cartItems.Add(new CartItem(request.ProductId, request.Quantity));

        HttpContext.Session.SetString("cart", JsonSerializer.Serialize(cartItems));
        return Ok();
    }
}
```

## Redis Data Structures

### Hash (объекты)

```csharp
// Сохранение объекта как Hash
var hashEntries = new HashEntry[]
{
    new("name", product.Name),
    new("price", product.Price.ToString()),
    new("category", product.Category)
};
await _db.HashSetAsync($"product:{id}", hashEntries);

// Получение
var hash = await _db.HashGetAllAsync($"product:{id}");
var product = new Product
{
    Name = hash.First(h => h.Name == "name").Value,
    Price = decimal.Parse(hash.First(h => h.Name == "price").Value)
};

// Инкремент поля
await _db.HashIncrementAsync("product:1", "views", 1);
```

### Set (уникальные значения)

```csharp
// Добавить в набор
await _db.SetAddAsync("product:1:tags", new RedisValue[] { "electronics", "phone", "apple" });

// Проверить наличие
var isMember = await _db.SetContainsAsync("product:1:tags", "phone");

// Пересечение наборов
var commonTags = await _db.SetCombineAsync(SetOperation.Intersect,
    "product:1:tags", "product:2:tags");
```

### Sorted Set (с весами)

```csharp
// Leaderboard
await _db.SortedSetAddAsync("leaderboard", "player1", 100);
await _db.SortedSetAddAsync("leaderboard", "player2", 150);

// Top 10
var topPlayers = await _db.SortedSetRangeByRankWithScoresAsync("leaderboard", 0, 9, Order.Descending);

// Ранг игрока
var rank = await _db.SortedSetRankAsync("leaderboard", "player1", Order.Descending);
```

### List (очередь)

```csharp
// Добавить в очередь
await _db.ListRightPushAsync("queue:tasks", JsonSerializer.Serialize(task));

// Взять из очереди (FIFO)
var taskJson = await _db.ListLeftPopAsync("queue:tasks");

// Блокирующее ожидание
var taskJson = await _db.ListLeftPopAsync("queue:tasks", timeout: TimeSpan.FromSeconds(30));
```

## Rate Limiting

```csharp
public class RateLimiter
{
    private readonly IDatabase _db;

    public async Task<bool> IsAllowedAsync(string key, int maxRequests, TimeSpan window)
    {
        var windowKey = $"ratelimit:{key}:{DateTime.UtcNow.Ticks / window.Ticks}";

        var count = await _db.StringIncrementAsync(windowKey);

        if (count == 1)
        {
            await _db.KeyExpireAsync(windowKey, window);
        }

        return count <= maxRequests;
    }
}

// Sliding window rate limiter
public async Task<bool> SlidingWindowRateLimitAsync(string key, int maxRequests, TimeSpan window)
{
    var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    var windowStart = now - (long)window.TotalMilliseconds;

    var transaction = _db.CreateTransaction();

    // Удалить старые записи
    _ = transaction.SortedSetRemoveRangeByScoreAsync(key, 0, windowStart);

    // Добавить новую запись
    _ = transaction.SortedSetAddAsync(key, now.ToString(), now);

    // Установить TTL
    _ = transaction.KeyExpireAsync(key, window);

    // Посчитать записи
    var countTask = transaction.SortedSetLengthAsync(key);

    await transaction.ExecuteAsync();

    return await countTask <= maxRequests;
}
```

## Health Check

```csharp
builder.Services.AddHealthChecks()
    .AddRedis("localhost:6379", name: "redis");
```
