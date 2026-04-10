---
description: Список Jenkins jobs и их статус через REST API
user-invocable: true
allowed-tools: Bash
argument-hint: "[folder/job-name | --view name]"
---

# /jk-jobs

Показать список Jenkins jobs через REST API.

**Goal:** Список jobs с их текущим статусом и результатом последнего билда.

**Output:** Таблица: name, color/status, last build number, last success, last failure.

**Scenarios:**

- Без аргументов -- все jobs верхнего уровня
- `folder/job-name` -- конкретная job или jobs внутри folder
- `--view name` -- jobs из конкретного Jenkins view

**Constraints:**

- Требует переменные окружения `JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`
- Если не заданы -- показать инструкцию настройки
- REST API: `$JENKINS_URL/api/json`
