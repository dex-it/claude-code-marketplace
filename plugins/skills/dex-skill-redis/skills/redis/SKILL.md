---
name: redis
description: Redis — кэширование, distributed lock, rate limiting, ловушки. Активируется при redis, cache, distributed cache, pub sub, lock, rate limit, StackExchange, ioredis, bullmq, session store, TTL, expire, redis cluster, sentinel, ZADD, key-value store
---

# Redis — ловушки и anti-patterns

## Подключение

### ConnectionMultiplexer на каждый запрос
Плохо: `ConnectionMultiplexer.Connect("localhost")` внутри метода — каждый вызов создает новое соединение
Правильно: ConnectionMultiplexer как Singleton через DI — один на приложение, thread-safe
Почему: каждый Connect открывает TCP-соединение + AUTH + SELECT DB. На 100 req/s = 100 соединений в секунду, Redis упрется в лимит

### AbortOnConnectFail не отключен
Плохо: дефолтный `AbortOnConnectFail = true` — приложение падает при старте если Redis недоступен
Правильно: `ConfigurationOptions { AbortOnConnectFail = false }` — retry в фоне
Почему: Redis может быть временно недоступен при деплое. С `true` — приложение не запустится, с `false` — подключится когда Redis появится

## Кэширование

### Кэш без TTL
Плохо: `StringSetAsync($"product:{id}", json)` без expiry — ключ живет вечно
Правильно: `StringSetAsync($"product:{id}", json, TimeSpan.FromMinutes(30))`
Почему: без TTL кэш растет бесконечно. Redis заполняет память, начинает eviction по maxmemory-policy, удаляя нужные ключи

### Cache stampede при miss
Плохо: cache miss — 100 потоков одновременно грузят из БД одни и те же данные
Правильно: distributed lock при cache miss — один поток грузит, остальные ждут + double-check после lock
Почему: 100 параллельных запросов к БД за одними данными = spike нагрузки, возможный timeout каскад

### Нет cache-aside pattern
Плохо: write-through без инвалидации — данные в кэше устаревают
Правильно: cache-aside: read cache -> miss -> load DB -> set cache. При write — invalidate cache key
Почему: без явной инвалидации пользователь видит stale data до истечения TTL

## Key Design

### Плоские ключи без namespace
Плохо: `Set("123", data)` — непонятно что за ключ, коллизии между entities
Правильно: `{entity}:{id}:{field}` — `product:123:details`, `user:456:session`
Почему: без namespace невозможно делать `SCAN product:*` для инвалидации, ключи конфликтуют между модулями

## Distributed Lock

### Release чужого лока
Плохо: `KeyDeleteAsync("lock:order:123")` — удаляет лок без проверки владельца
Правильно: Lua script: проверить что значение = мой token, только тогда DEL. Или `RedLock.net`
Почему: если лок expired по TTL и другой процесс его взял — `DEL` удалит чужой лок, два процесса работают одновременно

### Лок без TTL
Плохо: `StringSetAsync("lock:x", token, When.NotExists)` без expiry
Правильно: всегда TTL: `StringSetAsync("lock:x", token, TimeSpan.FromSeconds(30), When.NotExists)`
Почему: если процесс упал — лок никогда не освободится. Dead lock навсегда

### Одна нода для критичных локов
Плохо: distributed lock на одном Redis instance — при failover лок теряется
Правильно: RedLock алгоритм (RedLock.net) — кворум из N/2+1 нод
Почему: при failover replica не имеет лока (async replication). Два процесса получают лок одновременно

## Структуры данных

### String для partial update
Плохо: `StringSetAsync("user:1", fullJson)` — перезаписываешь весь объект при изменении одного поля
Правильно: `HashSetAsync("user:1", "email", newEmail)` — Hash для partial update
Почему: String = read-modify-write весь объект. Hash позволяет обновлять отдельные поля атомарно

### Pub/Sub для очереди задач
Плохо: Pub/Sub для job queue — если consumer offline, сообщения потеряны
Правильно: List (LPUSH/RPOP) или Redis Streams для persisted queue. Pub/Sub только для broadcast
Почему: Pub/Sub = fire-and-forget, нет persistence. Пропущенные сообщения не восстановить

## Rate Limiting

### Fixed window вместо sliding window
Плохо: fixed window counter с `INCR` + `EXPIRE` — burst на границе окон (2x лимит)
Правильно: sliding window через Sorted Set: `ZREMRANGEBYSCORE` + `ZADD` + `ZCARD`
Почему: в fixed window 100 запросов в конце окна + 100 в начале следующего = 200 за секунду при лимите 100

## Чек-лист

- ConnectionMultiplexer — Singleton
- AbortOnConnectFail = false
- TTL на каждом ключе
- Distributed lock с owner token + Lua release
- Cache stampede protection (lock при miss)
- Правильная структура данных под задачу
- Key naming: `{entity}:{id}:{field}`
