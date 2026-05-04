---
description: Список Jenkins jobs через jenkins-cli
user-invocable: true
allowed-tools: Bash
argument-hint: "[folder] [--view name]"
---

# /jk-jobs

Показать jobs Jenkins-сервера.

**Goal:** Список jobs с их статусом; для конкретной job -- детали (последние билды, parameters).

**Output:** Таблица jobs (name, color/status, last build, last success/failure). Для конкретной job -- расширенный вывод через `jenkins-cli get-job`.

**Scenarios:**

- Без аргументов -- `jenkins-cli list-jobs` (top-level).
- `folder` -- `jenkins-cli list-jobs <folder>` (jobs внутри folder).
- `--view name` -- jobs из конкретного Jenkins view.

**Constraints:**

- Требует `jenkins-cli` (Java + jenkins-cli.jar) в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Параметры подключения: env `JENKINS_URL`, `JENKINS_USER_ID`, `JENKINS_API_TOKEN` (используются как `-s $JENKINS_URL -auth $JENKINS_USER_ID:$JENKINS_API_TOKEN`).
- Read-only.
