---
description: Статус Kafka кластера — brokers, topics, consumer groups, lag
allowed-tools: Bash, Read, Grep
---

# /kafka-status

Быстрый снимок состояния Kafka кластера.

**Goal:** Получить статус Kafka — brokers, topics, consumer groups и consumer lag.

**Scenarios:**
- Без аргументов — overview: broker count, controller, topic count, total consumer groups
- `topics` — список topics с partition count, replication factor, ISR
- `groups` — consumer groups с state и total lag
- `<topic-name>` — детали конкретного topic: partitions, leaders, offsets
- `<group-name>` — детали consumer group: lag по партициям, coordinator

**Output:** Таблицы: brokers (id, host, controller), topics (name, partitions, RF), consumer groups (name, state, lag). Warnings для высокого lag или under-replicated partitions.

**Constraints:**
- console-consumer только с --max-messages (не бесконечное чтение)
- Определить способ подключения (kafka-*.sh или MCP) в начале
