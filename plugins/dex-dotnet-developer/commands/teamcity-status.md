---
description: Проверка статуса TeamCity builds, agents и очереди
allowed-tools: Bash, Read, Grep
---

# /teamcity-status

Проверка статуса TeamCity: builds, agents, очередь сборок.

## Использование

```
/teamcity-status              # Общий статус
/teamcity-status builds       # Последние сборки
/teamcity-status agents       # Статус агентов
/teamcity-status queue        # Очередь сборок
/teamcity-status [project]    # Сборки конкретного проекта
```

## Процесс

### 1. Проверка подключения

Используя TeamCity MCP или REST API:
```bash
# Fallback на curl если MCP недоступен
curl -s -H "Authorization: Bearer $TEAMCITY_TOKEN" \
  "$TEAMCITY_URL/app/rest/server" | jq '.version'
```

### 2. Статус последних сборок

**Через TeamCity MCP:**
- Получить последние 10 сборок
- Отфильтровать по статусу (SUCCESS, FAILURE, RUNNING)
- Показать детали неуспешных

**Через REST API:**
```bash
curl -s -H "Authorization: Bearer $TEAMCITY_TOKEN" \
  "$TEAMCITY_URL/app/rest/builds?locator=count:10&fields=build(id,buildTypeId,status,state,branchName)" | jq
```

### 3. Статус агентов

```bash
curl -s -H "Authorization: Bearer $TEAMCITY_TOKEN" \
  "$TEAMCITY_URL/app/rest/agents?fields=agent(id,name,connected,enabled,authorized)" | jq
```

### 4. Очередь сборок

```bash
curl -s -H "Authorization: Bearer $TEAMCITY_TOKEN" \
  "$TEAMCITY_URL/app/rest/buildQueue?fields=build(id,buildTypeId,branchName,waitReason)" | jq
```

## Выходной формат

```
TeamCity Status Report
━━━━━━━━━━━━━━━━━━━━━━

Server: https://teamcity.example.com
Version: 2024.07.1

Recent Builds (last 10):
┌────────────┬─────────────────────┬──────────┬──────────┐
│ Build ID   │ Configuration       │ Status   │ Branch   │
├────────────┼─────────────────────┼──────────┼──────────┤
│ #12345     │ MyApp_Build         │ ✅ OK    │ main     │
│ #12344     │ MyApp_Test          │ ❌ FAIL  │ develop  │
│ #12343     │ MyApp_Deploy        │ 🔄 RUN   │ main     │
└────────────┴─────────────────────┴──────────┴──────────┘

Failed Build Details:
- Build #12344: MyApp_Test
  Branch: develop
  Error: Test 'OrderServiceTests.CreateOrder_ShouldFail' failed
  Duration: 5m 23s

Agents:
┌──────────────────┬────────────┬─────────┐
│ Agent            │ Status     │ Pool    │
├──────────────────┼────────────┼─────────┤
│ build-agent-01   │ ✅ Online  │ Default │
│ build-agent-02   │ ✅ Online  │ Default │
│ build-agent-03   │ ⚠️ Offline │ Default │
└──────────────────┴────────────┴─────────┘

Queue: 2 builds waiting
- MyApp_Build (develop) - waiting for agent
- MyApp_IntegrationTests (main) - waiting for snapshot dependencies
```

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| 401 Unauthorized | Проверить TEAMCITY_TOKEN |
| Connection refused | Проверить TEAMCITY_URL |
| Build stuck | Проверить доступность агентов |
| Agent offline | Перезапустить agent service |
