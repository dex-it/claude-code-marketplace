---
description: Console output билда Jenkins через REST API
user-invocable: true
allowed-tools: Bash
argument-hint: job-name [build-number] [--tail N]
---

# /jk-logs

Показать console output билда Jenkins через REST API.

**Goal:** Вывести console log билда для анализа ошибок.

**Output:** Console output билда. С `--tail N` -- последние N строк.

**Scenarios:**

- `job-name` -- console output последнего билда
- `job-name build-number` -- console output конкретного билда
- `--tail N` -- последние N строк лога

**Constraints:**

- Требует переменные окружения `JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`
- Если не заданы -- показать инструкцию настройки
- REST API: `$JENKINS_URL/job/{name}/{id}/consoleText`
