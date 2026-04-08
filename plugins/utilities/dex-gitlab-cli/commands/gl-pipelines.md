---
description: Список и статус GitLab CI pipelines через glab
allowed-tools: Bash
argument-hint: "[--status running|failed|success] [--branch name] [pipeline-id]"
---

# /gl-pipelines

Показать GitLab CI pipelines текущего проекта через glab CLI.

**Goal:** Список pipelines или детали конкретного pipeline с jobs.

**Output:** Таблица: ID, status, branch, commit, duration. Для конкретного pipeline -- список jobs с их статусами.

**Scenarios:**

- Без аргументов -- последние 10 pipelines текущего проекта
- `--status running|failed|success` -- фильтр по статусу
- `--branch name` -- фильтр по ветке
- `pipeline-id` -- детальный вид конкретного pipeline со списком jobs

**Constraints:**

- Требует `glab` CLI установленный и аутентифицированный
- Если glab не найден -- показать инструкцию установки
