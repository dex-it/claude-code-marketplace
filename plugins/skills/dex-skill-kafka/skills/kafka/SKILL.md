---
name: kafka
description: Kafka — producers, consumers, exactly-once, ловушки. Активируется при kafka, producer, consumer, topic, partition, offset, consumer group, schema registry
allowed-tools: Read, Grep, Glob
---

# Kafka — ловушки и anti-patterns

## Producer

### Fire-and-forget без callback
Плохо: `_producer.Produce("topic", message)` — ошибка доставки теряется молча
Правильно: callback `_producer.Produce("topic", message, report => { if (report.Error.Code != NoError) log; })`
Почему: брокер может отвергнуть сообщение (leader unavailable, ISR < min). Без callback — данные потеряны без следа

### Random partition key
Плохо: `Key = Guid.NewGuid().ToString()` — каждый раз новый ключ
Правильно: `Key = order.Id.ToString()` — бизнес-ключ
Почему: сообщения одного заказа попадают в разные partitions → нет гарантии порядка. Consumer обработает "отменён" раньше "создан"

### Нет Flush() при shutdown
Плохо: producer dispose без `_producer.Flush(timeout)`
Правильно: `_producer.Flush(TimeSpan.FromSeconds(10))` перед dispose в `IHostedService.StopAsync`
Почему: Produce() буферизирует сообщения. Без Flush последние сообщения в буфере не отправляются

### Нет идемпотентности producer
Плохо: `EnableIdempotence = false` (default) → при retry дубликаты на брокере
Правильно: `EnableIdempotence = true` + `Acks = All`
Почему: сетевой timeout → producer retry → брокер получил оба → дубликат сообщения. Idempotent producer дедуплицирует по sequence number

## Consumer

### Auto commit — потеря при crash
Плохо: `EnableAutoCommit = true` — offset коммитится до обработки
Правильно: `EnableAutoCommit = false, EnableAutoOffsetStore = false` → `Commit(result)` после обработки
Почему: consumer crash после auto-commit, но до обработки → сообщение потеряно. Broker считает offset обработанным

### Нет rebalance handler
Плохо: `new ConsumerBuilder<string, string>(config).Build()` — без обработки rebalance
Правильно: `.SetPartitionsRevokedHandler((c, partitions) => { c.Commit(); })` — commit перед потерей partitions
Почему: при rebalance (новый consumer, crash) uncommitted offsets теряются → повторная обработка целого batch

### Consumer без idempotency
Плохо: обработка сообщения без проверки "уже обработано?"
Правильно: проверка MessageId/EventId перед обработкой, или идемпотентная операция (INSERT ON CONFLICT DO NOTHING)
Почему: Kafka = at-least-once delivery. Retry, rebalance, network glitch → сообщение приходит повторно

### Нет DLT (Dead Letter Topic)
Плохо: ошибочное сообщение вечно retry'ится → consumer stuck, lag растёт
Правильно: после N retry → отправить в `{topic}.DLT` с оригинальными headers + причиной ошибки
Почему: poison message блокирует partition. Одно битое сообщение → весь consumer group не движется

## Batch consumer — ловушка

### Commit последнего offset без обработки всего batch
Плохо: `ProcessBatchAsync(batch)` → exception на 50-м из 100 → `Commit(batch.Last())` в finally
Правильно: commit только после успешной обработки всего batch. Или: обрабатывай по одному с commit
Почему: commit offset 100 означает "всё до 100 обработано". Сообщения 50-100 потеряны

## Schema

### Изменение schema без Schema Registry
Плохо: сменил формат JSON сообщения → старые consumers падают с десериализацией
Правильно: Schema Registry + compatibility check (BACKWARD/FORWARD) перед deploy
Почему: producer и consumer деплоятся в разное время. Без schema evolution — breaking change = downtime
