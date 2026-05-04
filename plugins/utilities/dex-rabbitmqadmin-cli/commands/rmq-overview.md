---
description: Общий снимок RabbitMQ-кластера через rabbitmqadmin
user-invocable: true
allowed-tools: Bash
argument-hint: "[--node name] [--host url]"
---

# /rmq-overview

Общая картина состояния RabbitMQ-кластера.

**Goal:** Быстро увидеть версию брокера, ноды, message rates, общее число очередей/коннектов.

**Output:** Версия + Erlang/OTP, список нод (running, mem, fd, sockets), message rates (publish_in/out, deliver, ack), сводка по объектам (queues, exchanges, connections, channels, consumers).

**Scenarios:**

- Без аргументов -- `rabbitmqadmin show overview` + `list nodes`.
- `--node name` -- детали конкретной ноды (`show node`).
- `--host url` -- явный URL HTTP API (иначе из `~/.rabbitmqadmin.conf` или env `RABBITMQADMIN_*`).

**Constraints:**

- Требует `rabbitmqadmin` (rabbitmqadmin-ng) в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Параметры подключения: `~/.rabbitmqadmin.conf` (раздел default или `--node` имя профиля) или `--host`/`--port`/`--username`/`--password`/`--vhost`. Пароль не печатать в выводе.
- Read-only.
