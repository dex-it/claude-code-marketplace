---
description: Статус агентов TeamCity через REST API
allowed-tools: Bash
argument-hint: "[--pool name]"
---

# /tc-agents

Показать статус агентов TeamCity через REST API.

**Goal:** Список агентов с их статусом и текущими билдами.

**Output:** Таблица: name, status (connected/disconnected), authorized, current build (если есть), pool.

**Scenarios:**

- Без аргументов -- все агенты
- `--pool name` -- фильтр по agent pool

**Constraints:**

- Требует переменные окружения `TEAMCITY_URL` и `TEAMCITY_TOKEN`
- Если не заданы -- показать инструкцию настройки
