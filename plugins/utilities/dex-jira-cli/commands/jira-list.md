---
description: Поиск задач Jira по JQL через jira issue list, read-only, плоский вывод
user-invocable: true
allowed-tools: Bash
argument-hint: "\"<JQL>\" [--plain]"
---

# /jira-list

Найти задачи Jira по JQL read-only через `jira issue list`: связанные тикеты по эпику, статусу, спринту, автору, окну времени.

**Goal:** Установить объём слитой работы и связанные задачи для корреляции инцидента или ревью на стенде.

**Output:** Список задач по JQL (ключ, тип, статус, заголовок, исполнитель). С `--plain` -- машиночитаемый плоский вывод для дальнейшего разбора.

**Scenarios:**

- `"<JQL>"` -- сырой JQL-запрос (`jira issue list -q "<JQL>" --plain`)
- `--plain` -- плоский вывод без интерактивного TUI

**Constraints:**

- Требует `jira` (ankitpokhrel/jira-cli) в PATH с настроенным доступом (`jira init`); если бинаря нет -- показать инструкцию установки
- Read-only: только поиск и просмотр
