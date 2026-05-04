---
description: Состояние Redis-сервера через INFO
user-invocable: true
allowed-tools: Bash
argument-hint: "[section] [-u redis://...]"
---

# /redis-info

Snapshot состояния Redis-сервера.

**Goal:** Быстро увидеть версию, replication, persistence, clients, hit-rate, uptime для one-shot диагностики.

**Output:** Сгруппированные блоки `INFO` с пояснением ключевых метрик (`used_memory_human`, `connected_clients`, `keyspace_hits`/`misses`, `role`, `master_repl_offset`).

**Scenarios:**

- Без аргументов -- ключевые секции (`server`, `clients`, `memory`, `stats`, `replication`).
- `section` -- одна секция: `server` / `clients` / `memory` / `persistence` / `stats` / `replication` / `cpu` / `commandstats` / `keyspace`.
- `-u redis://...` -- явная строка подключения (иначе env `REDIS_URL` или `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`).

**Constraints:**

- Требует `redis-cli` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Пароль не печатать в выводе. Не логировать `-a <password>` -- предпочитать `REDISCLI_AUTH` или URI.
- Read-only.
