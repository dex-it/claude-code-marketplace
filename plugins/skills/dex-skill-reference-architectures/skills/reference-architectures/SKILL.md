---
name: reference-architectures
description: "Reference architecture ловушки: feed, chat, payment, search, rate-limiter. Активируется при feed architecture, push pull, fan-out, WebSocket, SSE, payment, idempotency, search indexing, rate limiter, notifications"
---

# Reference Architecture Selection Anti-Patterns

> Эти ловушки касаются выбора **внутри** распознанного паттерна (push vs pull для feed, WebSocket vs SSE для chat). Сам матч задачи с паттерном — работа архитектора, не skill.

## Reference Architecture Selection

### Feed: push vs pull без учёта соотношения writers/readers
Неправильно: всегда push (fan-out на write) или всегда pull (fan-out на read)
Правильно: pull при низком write QPS и высоком read; push при высоком write и моментальной доставке; hybrid для celebrity-аккаунтов (push для обычных, pull для звёзд)
Почему: push на followers=10M на каждый post = 10M записей; pull на каждый просмотр ленты = N×M join'ов. Соотношение определяет выбор, не «лучшая практика»

### Chat: long-poll/WebSocket/SSE без анализа двунаправленности
Неправильно: WebSocket по умолчанию для любого realtime
Правильно: SSE для server→client (notifications, live updates); WebSocket только если нужна client→server частая отправка; long-poll для редких событий и старых клиентов
Почему: WebSocket дороже в operational cost (sticky connection, балансировка, идле-таймауты), SSE проще и работает через HTTP/2

### Payment: один уровень consistency для всего payment-флоу
Неправильно: «у нас микросервисы → eventual везде» либо «strong consistency на всё, чтобы не думать»
Правильно: разделить — strong consistency на ledger / authorization / balance update; eventual consistency для notifications / receipts / analytics / dashboard; idempotency-key обязателен на write API; outbox для гарантии side-effects; saga с компенсациями для multi-step операций
Почему: eventual на ledger без idempotency = дубликат платежа (реальные деньги ушли дважды); strong consistency на notifications = блокировка payment'а если SMTP недоступен; разделение по criticality снижает blast radius при failure

### Search: один path для query и indexing
Неправильно: тот же endpoint обрабатывает запрос и обновляет индекс
Правильно: split — sync read path (low-latency query) + async pipeline (CDC → queue → indexer → search engine)
Почему: indexing = batch-friendly, query = latency-sensitive. Совмещение замедляет оба

### Notifications: fan-out без учёта hot users
Неправильно: fan-out на write для всех (даже у user'а с 50M followers)
Правильно: fan-out на write для tail (90% users <1K followers); fan-out на read (pull) для head (звёзды); граница — по числу followers (бизнес-метрика популярности), не по размеру row или payload в БД
Почему: написание 50M строк inbox при каждом посте звезды = write hot-spot, который кладёт DB; на 1K followers fan-out на write дешевле любого read-time aggregation'а

### Rate-limiter: алгоритм без анализа burstiness
Неправильно: token bucket по умолчанию для всех endpoint'ов
Правильно: token bucket — burst-tolerant; leaky bucket — стабильный rate; sliding window — точный счёт за интервал; fixed window — простой, но edge-burst в стыке окон
Почему: для billing API нужна стабильность (leaky); для UI-action — burst OK (token); для compliance audit — точный счёт (sliding)
