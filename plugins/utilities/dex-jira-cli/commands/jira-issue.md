---
description: Детали задачи Jira (ТЗ, критерии приёмки, связи) через jira issue view, read-only
user-invocable: true
allowed-tools: Bash
argument-hint: "<ISSUE-KEY> [--comments N]"
---

# /jira-issue

Показать детали задачи Jira read-only через `jira issue view`: описание, критерии приёмки, статус, связанные задачи и MR.

**Goal:** Получить ТЗ и контекст задачи как источник правды для реализации, ревью на стенде и расследования инцидента.

**Output:** Заголовок, тип, статус, описание, критерии приёмки, связи. С `--comments N` -- последние N комментариев обсуждения.

**Scenarios:**

- `ISSUE-KEY` -- детали задачи (`jira issue view ISSUE-KEY`)
- `--comments N` -- добавить N последних комментариев к выводу

**Constraints:**

- Требует `jira` (ankitpokhrel/jira-cli) в PATH с настроенным доступом (`jira init`); если бинаря нет -- показать инструкцию установки и ссылку на [docs/CLI_UTILITIES.md](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/CLI_UTILITIES.md). Self-hosted Jira -- `JIRA_AUTH_TYPE=bearer` с PAT в `JIRA_API_TOKEN`
- Read-only: только просмотр, без create / edit / move / delete
