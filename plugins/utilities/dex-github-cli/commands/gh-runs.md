---
description: Список и статус GitHub Actions workflow runs через gh
user-invocable: true
allowed-tools: Bash
argument-hint: "[run-id | --workflow name | --status completed|in_progress|failure]"
---

# /gh-runs

Показать GitHub Actions workflow runs через gh CLI.

**Goal:** Список workflow runs или детали конкретного run с jobs.

**Output:** Таблица: run ID, workflow, status, branch, duration. Для конкретного run -- список jobs с их статусами и шагами.

**Scenarios:**

- Без аргументов -- последние 10 runs текущего репозитория
- `--workflow name` -- фильтр по workflow
- `--status completed|in_progress|failure` -- фильтр по статусу
- `--branch name` -- фильтр по ветке
- `run-id` -- детали конкретного run со списком jobs

**Constraints:**

- Требует `gh` CLI установленный и аутентифицированный
- Если gh не найден -- показать инструкцию установки
