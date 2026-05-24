---
description: Console output билда Jenkins через jenkins-cli console
user-invocable: true
allowed-tools: Bash
argument-hint: "job-name [build-number] [--tail N] [-f]"
---

# /jk-logs

Показать console output билда Jenkins.

**Goal:** Вывести console log билда для анализа ошибок (или follow live с `-f` пока билд идёт).

**Output:** Console output. С `--tail N` -- последние N строк. С `-f` -- стрим, пока билд не завершится.

**Scenarios:**

- `job-name` -- console output последнего билда (`jenkins-cli console <job>`).
- `job-name build-number` -- console output конкретного билда (`jenkins-cli console <job> <build>`).
- `--tail N` -- последние N строк (вывод обрезается клиентом).
- `-f` -- follow stream live (`jenkins-cli console <job> -f`).

**Constraints:**

- Требует `jenkins-cli` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Параметры подключения: env `JENKINS_URL`, `JENKINS_USER_ID`, `JENKINS_API_TOKEN`.
- `-f` блокирует -- использовать с явным таймаутом или `Ctrl-C`.
