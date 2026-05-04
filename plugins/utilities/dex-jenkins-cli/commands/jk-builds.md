---
description: Список и детали билдов Jenkins job через jenkins-cli
user-invocable: true
allowed-tools: Bash
argument-hint: "job-name [build-number | lastBuild | lastFailedBuild]"
---

# /jk-builds

Показать билды конкретной Jenkins job.

**Goal:** Список билдов job с результатом и длительностью; для конкретного билда -- детали (parameters, SCM, tests).

**Output:** Таблица: build #, result (SUCCESS/FAILURE/ABORTED), duration, timestamp, triggered by. Для конкретного билда -- параметры, SCM-changes, test summary.

**Scenarios:**

- `job-name` -- `jenkins-cli list-builds <job>` (последние билды).
- `job-name build-number` -- детали конкретного билда (`jenkins-cli get-build`).
- `job-name lastBuild | lastFailedBuild | lastSuccessfulBuild` -- символические builds.

**Constraints:**

- Требует `jenkins-cli` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Параметры подключения: env `JENKINS_URL`, `JENKINS_USER_ID`, `JENKINS_API_TOKEN`.
- Read-only.
