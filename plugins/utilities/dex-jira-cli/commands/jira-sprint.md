---
description: Задачи текущего или указанного спринта Jira через jira sprint list, read-only
user-invocable: true
allowed-tools: Bash
argument-hint: "[--current | <SPRINT_ID>]"
---

# /jira-sprint

Показать состав спринта Jira read-only через `jira sprint list`: что выкатывалось в окне, для корреляции инцидента с задачами.

**Goal:** Увидеть задачи спринта как окно изменений при расследовании и при установлении объёма приёмки.

**Output:** Задачи спринта (ключ, статус, заголовок, исполнитель). С `--plain` -- плоский вывод.

**Scenarios:**

- `--current` -- активный спринт (`jira sprint list --current --plain`)
- `SPRINT_ID` -- конкретный спринт (`jira sprint list SPRINT_ID`)

**Constraints:**

- Требует `jira` (ankitpokhrel/jira-cli) с настроенным доступом; спринт-команды требуют board с включёнными спринтами (Scrum)
- Read-only: только просмотр
