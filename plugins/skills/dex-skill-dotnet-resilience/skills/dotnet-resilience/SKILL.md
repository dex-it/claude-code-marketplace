---
name: dotnet-resilience
description: Устойчивость вызовов внешней зависимости .NET - где стоит политика, общий timeout и срок вызывающего, circuit breaker, фильтр сбоев, видимый fallback, конкурентные промахи кэша. Активируется при resilience, polly, retry, circuit breaker, timeout, HttpClient, StandardResilienceHandler, AddResilienceHandler, fallback, stampede, IMemoryCache, HybridCache, GetOrCreateAsync, поставщик не отвечает
---

# Resilience - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Политика устойчивости в сервисе-потребителе вместо клиента зависимости
- Timeout только на попытку, без общего на вызов
- Общий timeout вызова больше срока вызывающего
- Нестабильная зависимость без circuit breaker
- `catch (Exception)` вокруг вызова зависимости
- Fallback без лога и без метрики
- Конкурентные промахи кэша идут в зависимость каждый: `IMemoryCache.GetOrCreate(Async)` не атомарен, `Lazy` внутри его фабрики вызов не делит
