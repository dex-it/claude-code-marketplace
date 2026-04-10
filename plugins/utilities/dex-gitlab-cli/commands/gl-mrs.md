---
description: Список и детали GitLab merge requests через glab
user-invocable: true
allowed-tools: Bash
argument-hint: "[MR-number | --state opened|merged|closed]"
---

# /gl-mrs

Показать GitLab merge requests текущего проекта через glab CLI.

**Goal:** Список MR или детали конкретного merge request.

**Output:** Таблица: number, title, author, status, approvals. Для конкретного MR -- description, diff stats, reviewers, pipeline status.

**Scenarios:**

- Без аргументов -- открытые MR текущего проекта
- `--state opened|merged|closed` -- фильтр по состоянию
- `MR-number` -- полные детали конкретного MR

**Constraints:**

- Требует `glab` CLI установленный и аутентифицированный
- Если glab не найден -- показать инструкцию установки
