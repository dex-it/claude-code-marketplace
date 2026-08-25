---
description: План выполнения SQL-запроса в PostgreSQL через EXPLAIN
user-invocable: true
allowed-tools: Bash
argument-hint: "\"SELECT ...\" [--no-analyze] [--db name]"
---

# /psql-explain

Получить план выполнения запроса с интерпретацией bottleneck'ов.

**Goal:** Понять, как PostgreSQL выполнит запрос и где узкие места (Seq Scan на больших таблицах, nested loop с миллионами строк, отсутствие индекса).

**Output:** Текст плана + краткая интерпретация ключевых проблем (Seq Scan, Sort, Hash Join, rows estimate vs actual).

**Scenarios:**

- `"SELECT ..."` -- по умолчанию `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` -- запрос реально выполняется.
- `--no-analyze` -- только `EXPLAIN` (без выполнения) -- для долгих или потенциально опасных запросов.
- `--db name` -- подключиться к конкретной БД.

**Constraints:**

- Требует `psql` в PATH; если не найден -- показать инструкцию установки.
- `ANALYZE` реально выполняет запрос. Не использовать на запросах с `INSERT`/`UPDATE`/`DELETE` -- они изменят данные. Команда отвергает не-SELECT запросы аналогично `/psql-query`.
- Для длинных запросов (`ANALYZE` показывает `Execution Time` секунды+) -- предлагать оптимизацию через `dex-postgresql-specialist`.
