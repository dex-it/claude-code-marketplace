---
description: Статус RabbitMQ — очереди, exchanges, consumers, dead-letter
allowed-tools: Bash, Read, Grep
---

# /rabbit-status

Быстрый снимок состояния RabbitMQ.

**Goal:** Получить статус очередей, exchanges и consumers — с выделением проблемных (high message count, no consumers, DLQ).

**Scenarios:**
- Без аргументов — overview: все очереди с message count и consumer count, exchanges
- `<queue-name>` — детали конкретной очереди: messages ready/unacked, consumers, memory, state
- `dlq` — показать все dead-letter очереди с message count

**Output:** Таблицы: queues (name, messages, consumers, state), exchanges (name, type, bindings). Warnings для очередей без consumers или с растущим message count. DLQ summary.

**Constraints:**
- Для просмотра messages использовать ack_requeue_true (не терять сообщения)
- Определить способ подключения (rabbitmqadmin, Management API, MCP) в начале
