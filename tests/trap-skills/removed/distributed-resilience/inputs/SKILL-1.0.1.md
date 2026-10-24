---
name: distributed-resilience
description: "Resilience ловушки. Активируется при CAS, optimistic locking, lost update, race condition, retry, timeout, idempotency, circuit breaker, bulkhead, health check, liveness, readiness, graceful degradation, thundering herd, cascade failure, resilience"
---

# Distributed Systems Resilience Anti-Patterns

> Эти ловушки — про **поведение системы под нагрузкой и при сбоях**: race conditions при конкурентных обновлениях, cascade failures при падении downstream, потеря данных при rolling deploy. Применяются в Phase 6 (Deep Dive) архитектуры — после того, как высокоуровневые решения по storage, sharding и API уже приняты.

## Concurrency

### Concurrent updates без CAS / optimistic locking
Неправильно: `read → modify → write` без проверки, что значение не изменилось между read и write
Правильно: optimistic concurrency control — `UPDATE ... WHERE version = N RETURNING new_version`; conditional write в DynamoDB (ConditionExpression), Redis WATCH/MULTI; для critical state — explicit version column / etag / row hash; на 409 Conflict — retry с свежим read
Альтернатива: pessimistic locking (SELECT FOR UPDATE) только для коротких критичных секций — хуже масштабируется, но проще mental model
Почему: между read и write другой процесс мог изменить значение — write затрёт чужое изменение (lost update); на single instance проявляется как race condition; при horizontal scaling — гарантированно теряются обновления; добавление version column постфактум = миграция всех таблиц + переписывание update layer

### Background job с lost update
Неправильно: периодический job читает state, считает результат, пишет — без проверки, что state не изменился
Правильно: CAS pattern — `expected_value` в update, fail-and-retry если несовпадение; либо append-only event log + idempotent reducer; для расчётных job'ов — input/output snapshot с version
Почему: между read и write user мог обновить state через UI — job затрёт user'ское изменение свежим, но устаревшим расчётом; в распределённой системе jobs могут запуститься параллельно (двойная обработка) — без CAS оба завершатся «успешно» с разным результатом

### Distributed lock как замена CAS
Неправильно: брать distributed lock (Redis SETNX, ZooKeeper) на каждое обновление shared state
Правильно: для high-contention state — CAS (lock-free); distributed lock — только для координации long-running критичных секций (миграция, exclusive scheduled job); lock с auto-expiry (lease) и явной обработкой clock skew
Почему: distributed lock = SPOF (lock server лёг → вся работа стоит) + sensitive to clock skew (две ноды считают что они owner) + failure-recovery сложнее CAS; для inc counter / update field CAS быстрее и устойчивее на порядок

## Reliability

### Retry без idempotency
Неправильно: client retry'ит запрос на server при timeout/5xx — без guarantee, что server обработает повтор как тот же запрос
Правильно: idempotency-key в headers / payload (UUID, генерируемый client'ом); server хранит результат предыдущего запроса с этим ключом N минут; повторный запрос возвращает закешированный результат, не выполняет операцию заново; для критичных операций (платежи, order placement) — idempotency-key обязателен на уровне API contract
Почему: timeout не означает «не обработано» — server мог успеть выполнить, но ответ потерялся в сети; retry без idempotency = дубликат операции (double charge, двойной order, двойная message в очереди); архитектурно вводить idempotency постфактум = breaking API change

### Timeout не настроен или равен infinity
Неправильно: HTTP-клиент без явного timeout — ждёт бесконечно; либо timeout, скопированный «на глаз» из примера
Правильно: timeout всегда явный и **меньше**, чем upstream timeout (client < gateway < service < downstream); типично 1-5s для пользовательских запросов, 30s+ для batch; разделять connect timeout и read timeout
Почему: hung connection съедает thread/connection из pool; если timeout caller > timeout downstream — потеряли возможность retry, просто ждём впустую; cascade failure: один медленный downstream выжирает весь thread pool upstream и кладёт всю систему — классический случай availability incident

### Retry без exponential backoff и jitter
Неправильно: фиксированный retry interval (например, каждые 100ms) либо retry без задержки в цикле
Правильно: exponential backoff (100ms → 200ms → 400ms → 800ms) + random jitter (±20-50%); max retries обычно 3-5; для long-running — capped exponential (max 30s)
Почему: при сбое downstream все client'ы retry одновременно через 100ms — thundering herd, downstream не успевает восстановиться, лежит дольше; jitter рассинхронизирует retry'и, размазывая нагрузку по времени; без max retries — infinite loop при перманентной ошибке

### Retry на cross-service вызовах без circuit breaker
Неправильно: вызвать downstream → fail → retry → fail → retry — пока downstream не оживёт
Правильно: circuit breaker (Polly / Resilience4j / Hystrix-pattern): после N fails в окне T — open circuit (мгновенный fail без вызова downstream) на cooldown период, после — half-open пробный вызов, при успехе — close; разделять circuit per-downstream, не глобально
Почему: downstream упал → upstream продолжает долбить → нагрузка не даёт downstream восстановиться → cascade поднимается вверх по зависимостям → весь stack лежит; circuit breaker даёт downstream breathing room и upstream быстрый fail вместо ожидания timeout

### Graceful degradation не спроектирован
Неправильно: при failure downstream — return 500, просить user retry
Правильно: каждая зависимость классифицирована — critical (без неё не работаем) vs degradable (отдаём fallback); для degradable: stale cache, default value, partial response, async fallback; explicit fallback policy в коде, не try/catch со swallow
Почему: SLA 99.9% при 3 critical зависимостях с 99.9% каждая = ~99.7% реальных; degradable зависимости позволяют изолировать failure; user видит «recommendations недоступны» вместо «весь сайт лежит»

### Bulkheads не разделены
Неправильно: один thread pool / connection pool для всех downstream вызовов
Правильно: bulkhead pattern — изолированные пулы ресурсов per-downstream; thread pool, connection pool, semaphore per критичный downstream; ограничение max concurrent calls
Почему: медленный downstream съедает весь shared pool → быстрые downstream тоже становятся недоступны (ресурсы кончились); per-downstream pool изолирует — failure одного не валит остальные

### Health check как простой ping
Неправильно: health endpoint возвращает 200 OK без проверки зависимостей; либо проверяет всё (включая optional downstream'ы)
Правильно: разделение liveness (процесс жив, kill+restart если нет) vs readiness (готов принимать трафик, drop из LB если нет); readiness проверяет critical зависимости с коротким timeout; degradable зависимости в health не включаются (иначе их failure валит твой сервис из LB)
Почему: ping без проверки depends = LB шлёт трафик в pod, который не может обработать (DB connection pool exhausted, downstream auth недоступен); проверка optional dependencies в readiness = твой сервис лежит когда optional downstream лежит = cascade through LB
