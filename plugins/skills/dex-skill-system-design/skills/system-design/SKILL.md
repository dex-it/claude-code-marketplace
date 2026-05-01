---
name: system-design
description: "System design — ловушки NFR, capacity, sharding key, reference architectures (feed/chat/payment), read/write ratio, hot path. Активируется при system design, NFR, capacity, scalability, CAP, PACELC, sharding, hot partition, SLA, SLO"
---

# System Design Anti-Patterns

## NFR Traps

### NFR без конкретных чисел
Неправильно: "система должна быть быстрой и масштабируемой"
Правильно: "p95 latency < 200ms при 1000 RPS, горизонтальное масштабирование до 10 нод"
Почему: без чисел невозможно валидировать архитектуру и выбрать технологии

### SLA без SLO и SLI
Неправильно: "SLA 99.9%" без определения что именно измеряется
Правильно: SLI (метрика: % успешных запросов) → SLO (цель: 99.9%) → SLA (контракт с penalties)
Почему: SLA без SLO — пустое обещание, нельзя мониторить и алертить

### Availability vs Uptime
Неправильно: путать availability (доля успешных запросов) и uptime (время работы сервера)
Правильно: availability = successful requests / total requests за период
Почему: сервер может быть up, но отдавать 500. Uptime 99.99% ≠ availability 99.99%

### Игнорирование p99 latency
Неправильно: ориентироваться на average latency (50ms)
Правильно: смотреть p95/p99 — часто в 10-50x от average
Почему: average скрывает tail latency, который бьёт по UX real users

## Capacity Planning

### Planning по average load
Неправильно: "средняя нагрузка 100 RPS, нужен сервер на 100 RPS"
Правильно: планировать на peak × safety margin (обычно 3-5x от average)
Почему: peak может быть 10x от average (чёрная пятница, утренний час-пик)

### Игнорирование write amplification
Неправильно: считать только user-facing запросы
Правильно: 1 API call = N DB queries + M cache ops + K message publishes
Почему: внутренний трафик часто 10-100x от внешнего, узкое место — не API

### Нет back-of-envelope estimation
Неправильно: "потом оптимизируем если надо"
Правильно: прикинуть на салфетке — 1M users × 10 requests/day × 5KB = 50GB/day
Почему: позволяет отсечь нереалистичные решения на старте (SQLite для 10TB)

## Scalability Anti-Patterns

### Premature horizontal scaling
Неправильно: сразу проектировать distributed систему на 3 пользователя
Правильно: начать с vertical scaling, horizontal — когда vertical исчерпан
Почему: distributed = сложность (consensus, network partitions, eventual consistency)

### Stateful services
Неправильно: хранить сессии/кэш в памяти процесса
Правильно: externalize state (Redis, DB), сделать сервисы stateless
Почему: stateful сервис нельзя горизонтально масштабировать без sticky sessions

### Shared mutable state между сервисами
Неправильно: два сервиса пишут в одну таблицу БД
Правильно: каждый сервис владеет своими данными, общение через API/события
Почему: shared DB = скрытая связность, невозможно независимо масштабировать и деплоить

## CAP / Consistency

### Strong consistency когда достаточно eventual
Неправильно: ACID транзакции между микросервисами (distributed transactions, 2PC)
Правильно: eventual consistency + saga/outbox для большинства бизнес-процессов
Почему: 2PC = single point of failure + latency, допустим только для financial-grade операций

### Игнорирование PACELC
Неправильно: "мы выбрали AP по CAP, значит consistency не важна"
Правильно: PACELC — даже без partition есть trade-off latency vs consistency
Почему: CAP — про failure mode, PACELC — про normal operation, оба важны

### CAP как binary choice
Неправильно: "наша система CP" или "наша система AP"
Правильно: разные части системы могут иметь разные guarantees (payments = CP, recommendations = AP)
Почему: CAP — per-operation, а не per-system решение

## Technology Evaluation

### CV-driven development
Неправильно: "возьмём Kafka потому что это модно"
Правильно: явные критерии выбора — throughput, latency, operational cost, team expertise
Почему: каждая технология = operational burden, Redis Queue часто достаточно вместо Kafka

### Нет PoC перед adoption
Неправильно: принять решение по документации и блог-постам
Правильно: PoC на реальных данных и нагрузке, замерить latency/throughput/resource usage
Почему: benchmarks вендора ≠ ваш workload, разница может быть в 10x

### Игнорирование operational cost
Неправильно: сравнивать только features и performance
Правильно: учитывать — мониторинг, обновления, backup, hiring, on-call burden
Почему: managed PostgreSQL дешевле self-hosted CockroachDB даже если CockroachDB "лучше"

## Reference Architecture Selection

### Feed: push vs pull без учёта соотношения writers/readers
Неправильно: всегда push (fan-out на write) или всегда pull (fan-out на read)
Правильно: pull при низком write QPS и высоком read; push при высоком write и моментальной доставке; hybrid для celebrity-аккаунтов (push для обычных, pull для звёзд)
Почему: push на followers=10M на каждый post = 10M записей; pull на каждый просмотр ленты = N×M join'ов. Соотношение определяет выбор, не «лучшая практика»

### Chat: long-poll/WebSocket/SSE без анализа двунаправленности
Неправильно: WebSocket по умолчанию для любого realtime
Правильно: SSE для server→client (notifications, live updates); WebSocket только если нужна client→server частая отправка; long-poll для редких событий и старых клиентов
Почему: WebSocket дороже в operational cost (sticky connection, балансировка, идле-таймауты), SSE проще и работает через HTTP/2

### Payment: eventual consistency
Неправильно: «у нас микросервисы, поэтому eventual для платежей»
Правильно: всегда idempotency-key на API + outbox для side-effect'ов + saga с компенсациями; strong consistency на уровне ledger, eventual для notifications/analytics
Почему: дубликат платежа = реальные деньги ушли дважды; ретрай без idempotency = double charge

### Search: один path для query и indexing
Неправильно: тот же endpoint обрабатывает запрос и обновляет индекс
Правильно: split — sync read path (low-latency query) + async pipeline (CDC → queue → indexer → search engine)
Почему: indexing = batch-friendly, query = latency-sensitive. Совмещение замедляет оба

### Notifications: fan-out без учёта hot users
Неправильно: fan-out на write для всех (даже у user'а с 50M followers)
Правильно: fan-out на write для tail (90% users <1K followers); fan-out на read (pull) для head (звёзды); граница — по бизнес-метрике (subscribers, не размер)
Почему: написание 50M строк inbox при каждом посте звезды = write hot-spot, который кладёт DB

### Rate-limiter: алгоритм без анализа burstiness
Неправильно: token bucket по умолчанию для всех endpoint'ов
Правильно: token bucket — burst-tolerant; leaky bucket — стабильный rate; sliding window — точный счёт за интервал; fixed window — простой, но edge-burst в стыке окон
Почему: для billing API нужна стабильность (leaky); для UI-action — burst OK (token); для compliance audit — точный счёт (sliding)

## Sharding Key Selection

### Hot partition: shard key с длинным хвостом
Неправильно: shard by user_id когда 1% пользователей создают 80% трафика
Правильно: composite key (user_id + bucket_id) или route hot users на dedicated shards (tier-based)
Почему: одна партиция выдерживает 100% load одного shard'а, остальные стоят пустые — это не sharding, это single point of contention

### Hash mod N для партиционирования
Неправильно: `hash(key) % N` для роутинга на N серверов
Правильно: consistent hashing — добавление/удаление сервера двигает только ~1/N ключей, не весь dataset
Почему: при N→N+1 в hash mod N **все** ключи переезжают; rebalancing занимает часы и кладёт latency

### Multi-tenant: shard by tenant без учёта размера
Неправильно: `shard = hash(tenant_id) % N`
Правильно: tier-based — small tenants в shared shards (десятки на shard), medium в dedicated, large на own infra; reshuffle при росте tenant
Почему: один enterprise tenant может быть в 10000× раз больше small — общий shard невозможно балансировать

### Cross-shard queries дизайнятся постфактум
Неправильно: «sharded — потом разберёмся как делать report по всем shards»
Правильно: сразу решить — scatter-gather (N×latency), CDC → analytics warehouse, или отдельный read-store с denormalization
Почему: scatter-gather на 100 shards = 99 ждут самого медленного (tail latency); добавлять warehouse-pipeline постфактум = переписывать ingestion

## Read:Write Ratio Estimation

### Кеш ставится без проверки ratio
Неправильно: «кешируем чтобы быстрее»
Правильно: cache имеет смысл при read:write ≥ 10:1; иначе invalidation overhead ≥ выгоды
Почему: при 1:1 каждое чтение followed by записью с invalidation — кеш hit-rate ~0%, остаются только издержки

### Ignore background reads при оценке нагрузки
Неправильно: считать только user-facing запросы
Правильно: учитывать analytics-pipelines, replication reads, backup, search-index rebuild — часто 5-10× от user reads
Почему: 80% read load на primary могут быть от ETL ночью, primary не выдержит peak hour user'ов

### Denormalization без обоснования ratio
Неправильно: «нормализуем по 3NF, потому что best practice»
Правильно: денормализация оправдана при read:write > 100:1 на конкретной таблице; для write-heavy (audit log) — наоборот, минимальная денормализация
Почему: денормализация = N мест обновлять при write; при write-heavy это убивает throughput

## Hot Path Identification

### Premature optimization холодного пути
Неправильно: оптимизировать admin-endpoint (10 запросов в день)
Правильно: 90/10 правило — сначала найти hot 10% (по volume × latency-cost), их и оптимизировать
Почему: ускорение admin с 1s до 100ms = 9s выгоды в день; ускорение feed-load с 200ms до 100ms при 1M RPS = тысячи compute-часов

### Feature без анализа hot path scope
Неправильно: новая фича сразу в hot path (например, ML-recommendation внутри feed-load)
Правильно: вынести heavy computation в async (precompute → cache → serve); hot path только assembly из готовых данных
Почему: добавление 50ms ML-call в feed-load с 100ms latency = 50% degradation для всего трафика; precompute раз в час с cache hit делает добавку «бесплатной»
