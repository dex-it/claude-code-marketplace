---
description: Детали билда Jenkins через REST API
user-invocable: true
allowed-tools: Bash
argument-hint: "job-name [build-number | lastBuild | lastFailedBuild]"
---

# /jk-builds

Показать детали билда Jenkins через REST API.

**Goal:** Информация о конкретном билде -- статус, параметры, изменения, тесты.

**Output:** Build number, result, duration, parameters, SCM changes, test results summary.

**Scenarios:**

- `job-name` -- последний билд
- `job-name build-number` -- конкретный билд
- `job-name lastFailedBuild` -- последний упавший билд
- `job-name lastSuccessfulBuild` -- последний успешный

**Constraints:**

- Требует переменные окружения `JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`
- Если не заданы -- показать инструкцию настройки
