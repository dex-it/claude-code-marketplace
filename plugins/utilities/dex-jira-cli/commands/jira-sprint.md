---
description: Задачи текущего или указанного спринта Jira через jira sprint list, read-only
user-invocable: true
allowed-tools: Bash
argument-hint: "[--current]"
---

# /jira-sprint

Показать задачи активного спринта Jira read-only через `jira sprint list --current --plain`: что выкатывалось в окне, для корреляции инцидента с задачами.

**Goal:** Увидеть задачи спринта как окно изменений при расследовании и при установлении объёма приёмки.

**Output:** Задачи активного спринта (ключ, статус, заголовок, исполнитель), плоский вывод.

**Scenarios:**

- без аргумента или `--current` -- задачи активного спринта (`jira sprint list --current --plain`)
- состав конкретного спринта по ID -- через `/jira-list` с JQL `sprint = <ID>`

**Constraints:**

- Требует `jira` (ankitpokhrel/jira-cli) в PATH с настроенным доступом; если бинаря нет -- показать инструкцию установки. Спринт-команды требуют board с включёнными спринтами (Scrum)
- Read-only: только просмотр
