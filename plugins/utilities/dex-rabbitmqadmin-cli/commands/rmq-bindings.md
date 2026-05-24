---
description: Bindings RabbitMQ — как сообщения роутятся между exchanges и queues
user-invocable: true
allowed-tools: Bash
argument-hint: "[--source exchange] [--destination queue] [--vhost name]"
---

# /rmq-bindings

Карта routing'а в RabbitMQ.

**Goal:** Понять, как сообщения попадают из exchange в очередь -- routing keys, headers-аргументы, цепочки exchange→exchange.

**Output:** Таблица bindings: source (exchange), destination (queue/exchange), routing_key, arguments. Группировка по source.

**Scenarios:**

- Без аргументов -- все bindings default vhost (`rabbitmqadmin list bindings`).
- `--source exchange` -- bindings от конкретного exchange (что роутится из него).
- `--destination queue` -- bindings к конкретной очереди (откуда идут сообщения).
- `--vhost name` -- bindings в конкретном vhost.

**Constraints:**

- Требует `rabbitmqadmin` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Read-only. Создание/удаление bindings -- только вручную или через `dex-rabbitmq-specialist`.
