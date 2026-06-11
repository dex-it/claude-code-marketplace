---
name: dotnet-caching
description: .NET caching — IMemoryCache, HybridCache, cache tags, invalidation, eviction. Активируется при cache, кеш, IMemoryCache, HybridCache, EvictByTagAsync, GetOrCreateAsync, cache tag, SizeLimit, AddMemoryCache, cache invalidation, stampede
---

# .NET Caching — ловушки и anti-patterns

## Memory management

### IMemoryCache без SizeLimit — неограниченный рост до OOM
Плохо: `services.AddMemoryCache()` без `SizeLimit`; крупные объекты кешируются без `entry.Size = N` — процесс растёт до OOM, или GC запускает eviction с деградацией
Правильно: `AddMemoryCache(o => o.SizeLimit = 1024)` + каждый entry выставляет `entry.Size = 1` (или пропорционально объёму); без `Size` entry учитывается нулём и лимит бесполезен
Почему: `IMemoryCache` по умолчанию не ограничен; без `SizeLimit` `entry.Size` игнорируется; под нагрузкой с крупными payload — постепенная утечка памяти без очевидного симптома

## Concurrency

### Cache stampede — N потоков вычисляют одно и то же при истечении ключа
Плохо: `var v = cache.Get(key); if (v == null) { v = await ComputeAsync(ct); cache.Set(key, v); }` — при истечении TTL N потоков видят miss и параллельно уходят в БД
Правильно: `cache.GetOrCreate(key, e => ...)` или `HybridCache.GetOrCreateAsync(key, ct, factory)` — кеш-слой гарантирует один inflight запрос на ключ
Почему: stampede при истечении популярного ключа = пик N×нагрузки на backend; `GetOrCreateAsync` с lock-per-key устраняет дублирование без явной синхронизации

## Key design

### Cache key без всех осей изменяемости → коллизия или stale данные
Плохо: `$"result-{id}"` — не включает tenant, тип данных или версию схемы; в multi-tenant сервисе данные одного пользователя видит другой; после смены контракта — устаревший объект
Правильно: ключ содержит все оси: `$"v1:{tenantId}:{entityType}:{id}"`; при breaking change контракта — инкремент версии в ключе
Почему: добавление tenant без ротации ключей — молчаливая утечка данных; ключ без версии — устаревший объект после деплоя нового контракта; исправить retroactively = полный flush кеша

## Invalidation

### Endpoint инвалидации покрывает меньше тегов, чем программный путь
Плохо: служебный `DELETE /api/debug/cache` сбрасывает только тег A, тогда как программная инвалидация в handler — теги A + B + C; инженер на стенде получает неполный сброс без ошибки
Правильно: вынести набор тегов инвалидации в единый extension-метод, вызываемый и из handler-а, и из debug endpoint — один source of truth «что есть полный сброс»
Почему: рассогласование endpoint ↔ код незаметно растёт при добавлении тегов; инженер диагностирует несуществующую проблему после «полного» сброса, теряя время

### HybridCache.EvictByTagAsync без L2 не синхронизирует другие экземпляры
Плохо: `await _cache.EvictByTagAsync("tag", ct)` без настроенного `IDistributedCache` — инвалидация прошла только в L1 текущего pod-а; остальные экземпляры продолжают отдавать stale данные
Правильно: для тег-инвалидации в multi-instance деплое настроить L2: `HybridCache` + `IDistributedCache` (Redis); без L2 — short TTL как единственный механизм согласованности
Почему: L1 каждого экземпляра независим; `EvictByTagAsync` без L2 — локальная операция; stale-окно у остальных = их TTL, не «инвалидация прошла»

## Чек-лист

- `AddMemoryCache` — указан `SizeLimit`? Все entry устанавливают `Size`?
- Используется `GetOrCreate`/`GetOrCreateAsync`, не ручной get-check-set?
- Cache key включает все оси изменяемости (tenant, тип, версия схемы)?
- Debug endpoint инвалидирует тот же набор тегов, что и программный путь?
- Multi-instance + тег-инвалидация: настроен L2 `IDistributedCache`?
