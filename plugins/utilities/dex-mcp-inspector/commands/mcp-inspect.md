---
description: Запустить MCP Inspector для тестирования и отладки MCP сервера
allowed-tools: Bash, Read
argument-hint: "[server-name | command args]"
---

# /mcp-inspect

Формирует команду запуска MCP Inspector для указанного MCP сервера.

## Процесс

1. **Определить конфигурацию MCP серверов:**

Прочитать `.mcp.json` в текущем проекте. Если файла нет, прочитать `mcp/mcp-template.json` из каталога маркетплейса.

2. **Если аргумент не указан** — показать список доступных серверов из конфигурации и предложить выбрать.

3. **Если указано имя сервера** — найти его в конфигурации и извлечь `command`, `args` и `env`.

4. **Сформировать команду запуска:**

```
npx @modelcontextprotocol/inspector@latest <command> <args>
```

5. **Показать пользователю:**
   - Готовую команду для запуска
   - Список необходимых переменных окружения (из `env` или `_env` конфигурации сервера)
   - URL веб-интерфейса: `http://localhost:6274`

6. **Предложить пользователю запустить команду самостоятельно** через `! <команда>`, так как Inspector открывает интерактивный веб-UI.

## Важные нюансы

| Нюанс | Описание |
|-------|----------|
| Порты | Client: `CLIENT_PORT` (default 6274), Server: `SERVER_PORT` (default 6277) |
| Env-переменные | Должны быть установлены до запуска Inspector |
| SSE-серверы | Для SSE-транспорта добавить `--transport sse` |
| WSL | Браузер может не открыться автоматически, перейти по URL вручную |

## Примеры

### Запуск для GitLab MCP
```bash
npx @modelcontextprotocol/inspector@latest npx -y @modelcontextprotocol/server-gitlab
```

### Запуск для Docker MCP
```bash
npx @modelcontextprotocol/inspector@latest npx -y @modelcontextprotocol/server-docker
```

### Запуск с кастомным портом
```bash
CLIENT_PORT=8080 SERVER_PORT=8081 npx @modelcontextprotocol/inspector@latest npx -y @modelcontextprotocol/server-gitlab
```
