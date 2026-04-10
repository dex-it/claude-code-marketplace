---
description: Лог билда TeamCity через REST API
user-invocable: true
allowed-tools: Bash
argument-hint: "build-id [--tests] [--artifacts]"
---

# /tc-logs

Показать лог билда TeamCity через REST API.

**Goal:** Вывести build log для анализа ошибок.

**Output:** Build log. С `--tests` -- summary результатов тестов. С `--artifacts` -- список артефактов.

**Scenarios:**

- `build-id` -- полный build log
- `build-id --tests` -- результаты тестов (passed/failed/ignored, details по failed)
- `build-id --artifacts` -- список артефактов билда

**Constraints:**

- Требует переменные окружения `TEAMCITY_URL` и `TEAMCITY_TOKEN`
- Если не заданы -- показать инструкцию настройки
