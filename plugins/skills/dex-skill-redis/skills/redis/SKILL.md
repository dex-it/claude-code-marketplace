---
name: redis-patterns
description: Redis — кэширование, distributed lock, rate limiting, ловушки. Активируется при redis, cache, distributed cache, pub sub, lock, rate limit, StackExchange
allowed-tools: Read, Grep, Glob
---

# Redis Patterns

## Правила

- ConnectionMultiplexer — Singleton (один на приложение, thread-safe)
- IDatabase — Scoped (легковесный, получается из multiplexer)
- AbortOnConnectFail = false — не падай при старте если Redis недоступен
- Всегда TTL на ключи — без TTL кэш растёт бесконечно
- Key naming: `{entity}:{id}:{field}` — `product:123:details`
- Cache-aside: check cache → miss → load from DB → set cache

## Анти-паттерны

```csharp
// Плохо — новый ConnectionMultiplexer на каждый запрос
public class MyService
{
    public async Task DoWork()
    {
        var conn = ConnectionMultiplexer.Connect("localhost"); // утечка соединений!
        var db = conn.GetDatabase();
        // ...
    }
}

// Плохо — кэш без TTL → память Redis растёт вечно
await _db.StringSetAsync($"product:{id}", json); // никогда не expires

// Хорошо — всегда TTL
await _db.StringSetAsync($"product:{id}", json, TimeSpan.FromMinutes(30));

// Плохо — cache stampede (100 потоков одновременно грузят из БД при cache miss)
var cached = await _cache.GetStringAsync(key);
if (cached == null)
{
    var data = await _db.LoadExpensiveDataAsync(); // 100 потоков делают это параллельно
    await _cache.SetStringAsync(key, data);
}

// Хорошо — lock при cache miss (один поток грузит, остальные ждут)
var cached = await _cache.GetStringAsync(key);
if (cached == null)
{
    if (await _lock.AcquireAsync($"lock:{key}", TimeSpan.FromSeconds(10)))
    {
        try
        {
            cached = await _cache.GetStringAsync(key); // double check
            if (cached == null)
            {
                var data = await _db.LoadExpensiveDataAsync();
                await _cache.SetStringAsync(key, Serialize(data), TimeSpan.FromMinutes(30));
                return data;
            }
        }
        finally { await _lock.ReleaseAsync($"lock:{key}"); }
    }
}
```

## Distributed Lock — правильно

```csharp
// Плохо — release чужого лока
await _db.StringSetAsync("lock:order:123", "any", TimeSpan.FromSeconds(30), When.NotExists);
// ... обработка заняла 31 секунду, лок expired
// другой процесс взял лок
await _db.KeyDeleteAsync("lock:order:123"); // удалили ЧУЖОЙ лок!

// Хорошо — Lua script для атомарного release (проверяет owner)
var token = Guid.NewGuid().ToString();
await _db.StringSetAsync("lock:order:123", token, TimeSpan.FromSeconds(30), When.NotExists);
// ... обработка
var script = @"
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    else return 0 end";
await _db.ScriptEvaluateAsync(script, new RedisKey[] { "lock:order:123" }, new RedisValue[] { token });

// Ещё лучше — RedLock.net для production
await using var redLock = await _lockFactory.CreateLockAsync(
    resource: "order:123",
    expiryTime: TimeSpan.FromSeconds(30));
if (redLock.IsAcquired) { await ProcessOrderAsync(123); }
```

## Выбор структуры данных

| Задача | Структура | Не используй |
|--------|-----------|-------------|
| Кэш объекта | String (JSON) | Hash (overhead для маленьких объектов) |
| Объект с partial update | Hash | String (перезаписываешь весь объект) |
| Уникальные значения | Set | List (дубликаты) |
| Leaderboard / ranking | Sorted Set | Sort в приложении |
| Очередь задач | List (LPUSH/RPOP) | Pub/Sub (теряет сообщения) |
| Broadcast | Pub/Sub | List (нет fan-out) |

## Rate Limiting

```csharp
// Sliding window — точнее fixed window
public async Task<bool> IsAllowedAsync(string clientId, int maxRequests, TimeSpan window)
{
    var key = $"ratelimit:{clientId}";
    var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    var windowStart = now - (long)window.TotalMilliseconds;

    var tx = _db.CreateTransaction();
    _ = tx.SortedSetRemoveRangeByScoreAsync(key, 0, windowStart);
    _ = tx.SortedSetAddAsync(key, now.ToString(), now);
    _ = tx.KeyExpireAsync(key, window);
    var countTask = tx.SortedSetLengthAsync(key);
    await tx.ExecuteAsync();

    return await countTask <= maxRequests;
}
```

## Чек-лист

- [ ] ConnectionMultiplexer — Singleton
- [ ] AbortOnConnectFail = false
- [ ] TTL на каждом ключе
- [ ] Distributed lock с owner token + Lua release
- [ ] Cache stampede protection (lock при miss)
- [ ] Правильная структура данных под задачу
