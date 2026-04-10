---
description: Список и детали GitHub pull requests через gh
user-invocable: true
allowed-tools: Bash
argument-hint: "[PR-number | --state open|closed|merged]"
---

# /gh-prs

Показать GitHub pull requests через gh CLI.

**Goal:** Список PR или детали конкретного pull request с checks.

**Output:** Таблица: number, title, author, checks status, review status. Для конкретного PR -- description, diff stats, checks detail, reviewers.

**Scenarios:**

- Без аргументов -- открытые PR текущего репозитория
- `--state open|closed|merged` -- фильтр по состоянию
- `PR-number` -- полные детали с checks и review status

**Constraints:**

- Требует `gh` CLI установленный и аутентифицированный
- Если gh не найден -- показать инструкцию установки
