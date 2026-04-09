# dex-mcp-inspector

MCP Inspector для тестирования и отладки MCP серверов через интерактивный веб-интерфейс.

## Возможности

- Тестирование tools, resources и prompts MCP сервера
- Интерактивный веб-UI на `http://localhost:6274`
- Просмотр истории запросов и ответов
- Поддержка stdio и SSE транспортов

## Установка

```bash
claude plugins install ./plugins/utilities/dex-mcp-inspector
```

## Использование

```bash
/mcp-inspect gitlab
```

Команда найдет конфигурацию сервера в `.mcp.json` проекта или `mcp-template.json` маркетплейса и сформирует готовую команду запуска.

### Примеры

```bash
# Указать имя сервера из конфигурации
/mcp-inspect gitlab

# Без аргумента — покажет список доступных серверов
/mcp-inspect
```

## Как работает MCP Inspector

MCP Inspector (`npx @modelcontextprotocol/inspector`) — клиент для MCP серверов, аналогичный Swagger/Postman для REST API:

1. Подключается к MCP серверу через stdio или SSE
2. Отображает доступные tools, resources и prompts
3. Позволяет вызывать tools с произвольными параметрами
4. Показывает полные запросы и ответы

### Порты

| Переменная | Default | Описание |
|------------|---------|----------|
| `CLIENT_PORT` | `6274` | Порт веб-интерфейса |
| `SERVER_PORT` | `6277` | Порт прокси-сервера |

## Зависимости

- **Node.js** (для `npx`)

## Лицензия

GPL-3.0
