---
description: Логи GitLab CI job через glab
user-invocable: true
allowed-tools: Bash
argument-hint: "[pipeline-id] [job-name]"
---

# /gl-logs

Показать логи GitLab CI job через glab CLI.

**Goal:** Вывести лог конкретного CI job для анализа ошибок или проверки результата.

**Output:** Лог job. Если job не указан -- список jobs pipeline для выбора.

**Scenarios:**

- `pipeline-id job-name` -- лог конкретного job
- `pipeline-id` -- список jobs pipeline с их статусами для выбора
- Без аргументов -- текущий pipeline ветки, список jobs

**Constraints:**

- Требует `glab` CLI установленный и аутентифицированный
- Если glab не найден -- показать инструкцию установки
