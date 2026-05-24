---
description: Список билдов TeamCity через teamcity run list
user-invocable: true
allowed-tools: Bash
argument-hint: "[--project name] [--status SUCCESS|FAILURE|RUNNING] [--count N] [build-id]"
---

# /tc-builds

Показать билды TeamCity.

**Goal:** Список последних билдов с фильтрами; для конкретного билда -- детали.

**Output:** Таблица: build ID, project, build type, status, branch, duration, triggered by. Для конкретного `build-id` -- расширенный вывод через `teamcity run view`.

**Scenarios:**

- Без аргументов -- `teamcity run list` (последние билды активного сервера).
- `build-id` -- детали конкретного билда (`teamcity run view <id>`).
- `--project name` -- `teamcity run list --project <name>`.
- `--status SUCCESS|FAILURE|RUNNING` -- фильтр по статусу.
- `--count N` -- количество билдов.

**Constraints:**

- Требует `teamcity` (CLI от JetBrains) в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Сервер и аутентификация настраиваются через `teamcity auth login` (interactive) или env `TEAMCITY_URL` + `TEAMCITY_TOKEN`.
- Read-only.
