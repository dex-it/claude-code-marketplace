---
description: Выполнить read-only SQL-запрос в PostgreSQL через psql
user-invocable: true
allowed-tools: Bash
argument-hint: "\"SELECT ...\" [--db name] [--json]"
---

# /psql-query

Выполнить read-only SQL-запрос в PostgreSQL и вернуть результат.

**Goal:** Получить данные из БД для анализа, не изменяя состояние.

**Output:** Таблица результата (по умолчанию выровненная). С `--json` -- массив объектов через `row_to_json`.

**Scenarios:**

- `"SELECT ..."` -- выполнить переданный запрос
- `--db name` -- подключиться к конкретной БД (иначе из `PGDATABASE`)
- `--json` -- результат как JSON-массив

**Constraints:**

- Требует `psql` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Параметры подключения берутся из env (`PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`) или `~/.pgpass`. Пароль не печатать в выводе.
- Допустимы только `SELECT` / `EXPLAIN` / `SHOW` / `WITH ... SELECT`. Любой `INSERT`/`UPDATE`/`DELETE`/`DROP`/`TRUNCATE`/`ALTER`/`CREATE`/`GRANT` отвергается -- предложить `dex-postgresql-specialist` или явный psql вызов вне команды.
- Длинные запросы выполнять с `psql -c` без `EXPLAIN ANALYZE` (для планов есть `/psql-explain`).
