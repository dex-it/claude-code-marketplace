---
description: Статус агентов TeamCity через teamcity agent list
user-invocable: true
allowed-tools: Bash
argument-hint: "[--pool name] [agent-name]"
---

# /tc-agents

Показать агенты TeamCity.

**Goal:** Список агентов с состоянием и текущими билдами; для конкретного -- детали (capabilities, last activity).

**Output:** Таблица: name, status (connected/disconnected), authorized, current build (если есть), pool. Для конкретного агента -- `teamcity agent view`.

**Scenarios:**

- Без аргументов -- `teamcity agent list` (все агенты).
- `agent-name` -- детали (`teamcity agent view <name>`).
- `--pool name` -- фильтр по agent pool.

**Constraints:**

- Требует `teamcity` (CLI от JetBrains) в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Read-only. Для shell-доступа к агенту (`teamcity agent term`) или enable/disable -- использовать CLI напрямую, не через slash-команду.
