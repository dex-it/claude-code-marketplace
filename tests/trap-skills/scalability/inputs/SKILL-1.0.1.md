---
name: scalability
description: "Scalability ловушки: stateful, sharding. Активируется при scalability, horizontal scaling, stateless, stateful, sticky session, sharding, hot partition, hash mod N, consistent hashing, shard key, cross-shard"
---

# Scalability Anti-Patterns

## Scalability Anti-Patterns

### Premature horizontal scaling
Неправильно: сразу проектировать distributed систему на 3 пользователя
Правильно: начать с vertical scaling, horizontal — когда vertical исчерпан
Почему: distributed = сложность (consensus, network partitions, eventual consistency)

### Stateful services
Неправильно: хранить сессии/кэш в памяти процесса
Правильно: externalize state (Redis, DB), сделать сервисы stateless
Почему: stateful сервис нельзя горизонтально масштабировать без sticky sessions

### Hidden state в process memory
Неправильно: in-memory rate-limiter counter, dedupe set, scheduled task state — «у нас же только один pod»
Правильно: externalize state в Redis / DB / distributed cache; rate-limiter — shared (Redis INCR с TTL), dedupe — shared set с TTL, scheduled task — distributed lock (Redis Redlock / DB-based lease)
Почему: «один pod» = SPOF + блокирует horizontal scaling; rate-limiter становится N×limit'ом при N подах; scheduled tasks выполняются N раз; добавление externalization постфактум = переписывание всей логики state-management

### File system как state
Неправильно: писать файлы в локальный fs (uploads, generated reports, temp processing) — «диск-то есть»
Правильно: object storage (S3 / Blob / MinIO) для пользовательских файлов; shared FS (NFS / EFS) только если data-locality requirement; ephemeral fs только для temp в рамках одного request
Почему: container restart / pod reschedule = data lost; horizontal scaling = файлы доступны только на одном поде; backup и DR не работают для locally-stored data; объём диска — hard limit на growth

### Long-running connections как state
Неправильно: WebSocket / SSE / long-poll connection хранит state клиента в памяти server-instance, любой restart = потеря всех connections
Правильно: connection state externalized — state в Redis, instance только обслуживает active socket; reconnect восстанавливает state по session-id; sticky balancing допустим как optimization, не как requirement
Почему: deploy / autoscale / pod restart = массовый disconnect; стойкие connections блокируют rolling deploy; instance crash = клиенты теряют prefix сообщений и retry должен быть idempotent

### Shared mutable state между сервисами
Неправильно: два сервиса пишут в одну таблицу БД
Правильно: каждый сервис владеет своими данными, общение через API/события
Почему: shared DB = скрытая связность, невозможно независимо масштабировать и деплоить

## Sharding Key Selection

### Hot partition: shard key с длинным хвостом
Неправильно: shard by user_id когда 1% пользователей создают 80% трафика
Правильно: composite key (user_id + bucket_id) или route hot users на dedicated shards (tier-based)
Почему: одна партиция выдерживает 100% load одного shard'а, остальные стоят пустые — это не sharding, это single point of contention

### Hash mod N для horizontally-scalable
Неправильно: `hash(key) % N` для роутинга, **когда N может меняться** (добавление/удаление нод в кластере, autoscaling)
Правильно: consistent hashing (Ketama, jump-hash, Maglev) — добавление/удаление сервера двигает только ~1/N ключей, не весь dataset
Когда mod N допустим: N фиксирован архитектурно — partition count в Kafka topic, in-memory шарды в коде, pre-sharded storage с external mapping shard→node; изменение N в этих случаях требует переразбиения и так
Почему: при variable N → N+1 в hash mod N **все** ключи переезжают, rebalancing занимает часы и кладёт latency; при fixed N этой проблемы нет — выбор инструмента должен соответствовать тому, меняется ли N в рантайме

### Multi-tenant: shard by tenant без учёта размера
Неправильно: `shard = hash(tenant_id) % N`
Правильно: tier-based — small tenants в shared shards (десятки на shard), medium в dedicated, large на own infra; reshuffle при росте tenant
Почему: один enterprise tenant может быть в 10000× раз больше small — общий shard невозможно балансировать

### Cross-shard queries дизайнятся постфактум
Неправильно: «sharded — потом разберёмся как делать report по всем shards»
Правильно: сразу решить — scatter-gather (N×latency), CDC → analytics warehouse, или отдельный read-store с denormalization
Почему: scatter-gather на 100 shards = 99 ждут самого медленного (tail latency); добавлять warehouse-pipeline постфактум = переписывать ingestion
