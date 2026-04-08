---
description: Список билдов TeamCity через REST API
allowed-tools: Bash
argument-hint: "[project-name | --status SUCCESS|FAILURE|RUNNING] [--count N]"
---

# /tc-builds

Показать список билдов TeamCity через REST API.

**Goal:** Список последних билдов с фильтрацией по проекту или статусу.

**Output:** Таблица: build ID, project, build type, status, branch, duration, triggered by.

**Scenarios:**

- Без аргументов -- последние 10 билдов
- `project-name` -- билды конкретного проекта
- `--status SUCCESS|FAILURE|RUNNING` -- фильтр по статусу
- `--count N` -- количество билдов

**Constraints:**

- Требует переменные окружения `TEAMCITY_URL` и `TEAMCITY_TOKEN`
- Если не заданы -- показать инструкцию настройки
- REST API endpoint: `$TEAMCITY_URL/app/rest/builds`
