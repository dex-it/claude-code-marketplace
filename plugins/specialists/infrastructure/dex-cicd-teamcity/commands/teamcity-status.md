---
description: Статус TeamCity — builds, agents, очередь
allowed-tools: Bash, Read, Grep
---

# /teamcity-status

Быстрый снимок состояния TeamCity.

**Goal:** Получить статус recent builds, agents и build queue.

**Scenarios:**
- Без аргументов — overview: last 10 builds, agent status, queue size
- `builds` — детальный список recent builds с status, duration, changes
- `agents` — все agents: status, properties, current build
- `queue` — builds в очереди с wait reason
- `<project-name>` — builds конкретного проекта

**Output:** Таблицы: builds (config, status, duration, triggered by), agents (name, status, OS), queue (config, wait time, reason). Warnings для failed builds и disconnected agents.

**Constraints:**
- Определить способ подключения (MCP или REST API с $TEAMCITY_URL + $TEAMCITY_TOKEN) в начале
- Для failed builds автоматически показать failure reason из build log
