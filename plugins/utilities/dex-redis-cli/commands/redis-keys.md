---
description: Поиск ключей в Redis по паттерну через SCAN (без KEYS)
user-invocable: true
allowed-tools: Bash
argument-hint: "pattern [--count N] [--type string|hash|list|set|zset|stream] [-u redis://...]"
---

# /redis-keys

Найти ключи по паттерну с TYPE и TTL.

**Goal:** Безопасно посмотреть, что лежит в Redis по паттерну, не блокируя сервер.

**Output:** Список ключей с TYPE и TTL (или `no expire` / `expired`), сгруппированные по типу. В конце -- сводка (всего, по типам).

**Scenarios:**

- `pattern` -- поиск по паттерну (`user:*`, `session:abc:*`).
- `--count N` -- лимит результатов (default 100).
- `--type T` -- фильтр по типу значения.
- `-u redis://...` -- явная строка подключения.

**Constraints:**

- Требует `redis-cli` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- **Использовать только `SCAN`/`--scan`. `KEYS *` запрещён** -- блокирует Redis на больших keyspace и кладёт прод.
- Если pattern слишком широкий (`*` без префикса) на больших инстансах -- предупредить и попросить уточнить.
- Read-only.
