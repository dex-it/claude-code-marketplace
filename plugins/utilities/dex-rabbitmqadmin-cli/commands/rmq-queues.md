---
description: Список и состояние очередей RabbitMQ через rabbitmqadmin
user-invocable: true
allowed-tools: Bash
argument-hint: "[queue-name] [--vhost name] [--state running|idle|flow]"
---

# /rmq-queues

Состояние очередей в RabbitMQ.

**Goal:** Найти проблемные очереди (накопившиеся сообщения, отсутствующие consumers, idle/flow state), посмотреть детали конкретной очереди.

**Output:** Таблица очередей: name, vhost, messages_ready, messages_unacknowledged, consumers, memory, state. Для конкретной очереди -- детали: policy, arguments, message_stats, consumer_details.

**Scenarios:**

- Без аргументов -- список очередей default vhost (`rabbitmqadmin list queues`).
- `queue-name` -- детали очереди (`rabbitmqadmin show queue`): policy, arguments, consumers, message rates.
- `--vhost name` -- очереди в конкретном vhost (`/` или `--vhost /`).
- `--state running|idle|flow` -- фильтр по состоянию.

**Constraints:**

- Требует `rabbitmqadmin` в PATH; если не найден -- показать инструкцию установки.
- Read-only. `declare`, `delete`, `purge` намеренно не выведены наружу -- опасные операции выполняются вручную или через специалистов.
- На больших инстансах вывод list queues может быть длинным -- предлагать фильтр по vhost/state.
