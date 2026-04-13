---
name: dotnet-resilience
description: Resilience для HTTP клиентов — Polly, retry, timeout, circuit breaker. Активируется при resilience, polly, retry, circuit breaker, timeout, idempotency, flaky, HttpClient, Refit, StandardResilienceHandler, AddResilience
---

# Resilience — ловушки и anti-patterns

## Где ставить policy

### Resilience на листовом клиенте вместо корневого flaky-источника
Плохо: retry / circuit breaker навешены на промежуточный вторичный клиент (`OrdersApiClient`), при этом реальный источник нестабильности — VCS / auth / upstream-сервис на уровень ниже
Правильно: resilience policy ставится на **границе с нестабильной системой** — на том клиенте, который реально падает; листовой получает чистый контракт
Почему: если листовой клиент ретраит вместо корневого, каждый внешний сбой превращается в каскад ретраев выше по стеку (`N × M` запросов). Ретрай на листовом скрывает root cause и маскирует метрики корневого сервиса. Правило: `retry-policy` ставится на том HTTP-клиенте, который первым видит транспортный сбой

### Resilience на каждом слое (matryoshka retries)
Плохо: retry в `HttpClient` + retry в handler'е вокруг него + retry в pipeline MediatR
Правильно: одна точка retry на маршруте «наш-процесс → внешняя система»
Почему: вложенные ретраи умножаются (3 × 3 × 3 = 27 попыток). Внешняя система получает бомбу запросов, latency взрывается, circuit breaker верхнего слоя никогда не срабатывает. Retry — один уровень, ближайший к транспорту

## Retry

### Retry на неидемпотентной операции без Idempotency-Key
Плохо: retry на `POST /orders` без заголовка `Idempotency-Key` (или бизнес-ключа в теле)
Правильно: retry только на идемпотентных операциях (`GET`, `PUT`, `DELETE` с идемпотентными семантиками); для `POST` — либо Idempotency-Key, либо отказ от retry
Почему: повторный `POST` создаёт дубликат. При сетевой ошибке мы не знаем, дошёл запрос или нет — без Idempotency-Key ретрай = двойное списание / двойная запись

### Retry на 4xx клиентских ошибках
Плохо: policy ретраит любой non-2xx, включая `400 Bad Request` и `403 Forbidden`
Правильно: retry только на transient errors — `5xx` (кроме `501`), `408 Request Timeout`, `429 Too Many Requests` (с учётом `Retry-After`), и network-level exceptions (socket / timeout)
Почему: 4xx — это контракт «запрос не пройдёт, сколько ни повторяй». Ретраим 400 / 401 / 403 — бьём внешний сервис без шанса на успех, жжём quota, в auth-случаях блокируем аккаунт

### Retry без jitter / backoff
Плохо: фиксированный `RetryDelay = TimeSpan.FromSeconds(1)`
Правильно: exponential backoff с jitter (`DelayBackoffType = Exponential, UseJitter = true`)
Почему: одновременный всплеск у 1000 клиентов → все ретраят через ровно 1 секунду → thundering herd валит сервис повторно. Jitter размазывает ретраи во времени и даёт сервису шанс восстановиться

## Timeouts

### Только per-attempt timeout без total
Плохо: `AttemptTimeout = 10s`, retry 3 раза → суммарно запрос может жить 30+s и задержит вызывающий поток
Правильно: **per-attempt + total**. Per-attempt — защита от зависания одной попытки; total — защита от накопления latency через retry
Почему: per-attempt не ограничивает общее время. Под retry policy запрос может идти минуты, ASP.NET request будет жить пока не дойдёт до request-timeout. Total-timeout — явная граница пользовательского SLA

### Timeout больше, чем у вызывающего
Плохо: внутренний HTTP client с `Timeout = 60s` вызывается из ASP.NET-контроллера с дефолтным request-timeout 30s
Правильно: внутренний timeout строго меньше timeout'а вызывающего, с запасом на serialize / deserialize
Почему: если inner-timeout > outer-timeout, клиент (или ASP.NET) обрывает соединение раньше, чем наш код узнает о сбое. Потеря управления над failure path, запрос повисает в `InProgress` без финализации

## Circuit Breaker

### Нет circuit breaker при системно-нестабильной зависимости
Плохо: retry policy есть, circuit breaker — нет; при падении внешней системы все pods её бомбят в retry-цикле
Правильно: добавить circuit breaker с `MinimumThroughput`, `FailureRatio`, `BreakDuration`
Почему: retry без circuit breaker = DoS на восстанавливающийся сервис. Breaker быстро отказывает при серии сбоев, даёт внешней системе время на recovery и возвращает быстрый ответ пользователю вместо длинного timeout

### Catch generic Exception вместо типизированных
Плохо: `catch (Exception ex) { /* retry / ignore */ }` — скрывает `OperationCanceledException`, `OutOfMemoryException`, bugs
Правильно: типизированные предикаты в policy — `HandleResult<HttpResponseMessage>` + `Handle<HttpRequestException>` + `Handle<TimeoutRejectedException>`
Почему: `catch (Exception)` превращает resilience-слой в швабру — ловит отмену, критические ошибки процесса, NullReferenceException из бага. Retry начинает маскировать реальные баги

## Observability

### Нет метрик retry / circuit-breaker
Плохо: policy настроена, но телеметрия отсутствует — нельзя увидеть, сколько ретраев идёт в рантайме
Правильно: подписка на `ResilienceEvents` / OpenTelemetry-интеграция: счётчики `retry_attempts`, `circuit_breaker_state`, `timeout_rejections`
Почему: без метрик resilience — чёрный ящик. Нельзя калибровать лимиты, нельзя поймать момент, когда retry стал маскировать системную проблему (рост retry rate без роста ошибок в downstream — сигнал о выгорании SLO)

### Silent swallow в fallback
Плохо: `FallbackAction = _ => ValueTask.FromResult(new Response())` — возвращаем пустышку без лога и без метрики
Правильно: fallback возвращает осмысленную деградацию (кэш / default) + логирует / инкрементирует метрику «fallback triggered»
Почему: молчаливый fallback скрывает проблему от оператора. Пользователь видит «всё ок», система видит «всё ок», а реально внешний сервис лежит неделю. Fallback — это видимая деградация, не костыль «чтобы не падало»

## Чек-лист

- Resilience policy — на клиенте, который первым видит транспортный сбой (не на верхних слоях)
- Один уровень retry на маршруте «наш-процесс → внешняя система», без matryoshka
- Retry только на идемпотентных операциях (или с Idempotency-Key)
- Retry только на transient errors (5xx, 408, 429, network exceptions), не на 4xx
- Exponential backoff + jitter
- Per-attempt timeout + total timeout, оба меньше, чем у вызывающего
- Circuit breaker при системно-нестабильной зависимости
- Типизированные предикаты, не catch `Exception`
- Метрики retry / circuit-breaker / fallback в телеметрии
- Fallback — осмысленная деградация с логом, не silent swallow
