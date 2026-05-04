# dex-teamcity-cli

CLI-утилита для TeamCity. Быстрый доступ к builds, agents и build-логам через REST API.

## Команды

| Команда | Описание |
|---------|----------|
| `/tc-builds` | Список и детали builds |
| `/tc-agents` | Статус агентов |
| `/tc-logs` | Build-логи |

## Требования

- `curl` и `jq` в `PATH`
- Переменные окружения:
  - `TEAMCITY_URL` — URL сервера (например `https://teamcity.example.com`)
  - `TEAMCITY_TOKEN` — API access token

> В отличие от `gh` / `glab` / `kubectl`, плагин использует REST API напрямую через `curl` — отдельного CLI-бинаря ставить не нужно. Достаточно `curl` и `jq` (есть в большинстве дистрибутивов).

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — общий гайд по CLI-утилитам и матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-teamcity-cli@dex-claude-marketplace
```
