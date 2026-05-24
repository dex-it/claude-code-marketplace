---
description: Активные сессии, locks и slow queries в PostgreSQL
user-invocable: true
allowed-tools: Bash
argument-hint: "[--locks | --slow | --activity] [--db name]"
---

# /psql-locks

Диагностика runtime-состояния PostgreSQL: что прямо сейчас происходит в БД.

**Goal:** Найти blocking sessions, долгие транзакции, slow queries для оперативной диагностики прода.

**Output:** Таблица сессий/locks/queries с длительностью, состоянием, ожиданиями.

**Scenarios:**

- Без аргументов или `--activity` -- `pg_stat_activity`: PID, user, app, state, query, длительность транзакции/запроса.
- `--locks` -- блокирующие пары (blocking PID -> blocked PID) с типом lock'а и query обоих.
- `--slow` -- top-N запросов из `pg_stat_statements` по `total_exec_time` (если расширение установлено -- иначе явно сказать).
- `--db name` -- подключиться к конкретной БД.

**Constraints:**

- Требует `psql` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Read-only (только `pg_stat_*`/`pg_locks`); никакого `pg_terminate_backend`/`pg_cancel_backend` -- эти действия выполняет администратор отдельно.
- `--slow` требует `pg_stat_statements` в `shared_preload_libraries`. Если расширение отсутствует -- сообщить и предложить альтернативу через логи.
- На production -- запросы к `pg_stat_activity` должны выполняться от роли с `pg_read_all_stats`/`SUPERUSER`.
