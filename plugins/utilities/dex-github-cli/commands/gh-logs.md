---
description: Логи GitHub Actions run через gh
user-invocable: true
allowed-tools: Bash
argument-hint: "[run-id] [--failed]"
---

# /gh-logs

Показать логи GitHub Actions run через gh CLI.

**Goal:** Вывести логи workflow run для анализа ошибок.

**Output:** Лог run. С `--failed` -- только логи упавших steps.

**Scenarios:**

- `run-id` -- полный лог run
- `run-id --failed` -- только логи failed steps
- Без аргументов -- последний run текущей ветки

**Constraints:**

- Требует `gh` CLI установленный и аутентифицированный
- Если gh не найден -- показать инструкцию установки
