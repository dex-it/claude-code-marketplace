# dex-jenkins-cli

CLI-утилита для Jenkins. Быстрый доступ к jobs, builds и console output через REST API.

## Команды

| Команда | Описание |
|---------|----------|
| `/jk-jobs` | Список и детали jobs |
| `/jk-builds` | Детали build |
| `/jk-logs` | Console output |

## Требования

- `curl` и `jq` в `PATH`
- Переменные окружения:
  - `JENKINS_URL` — URL сервера (например `https://jenkins.example.com`)
  - `JENKINS_USER` — имя пользователя
  - `JENKINS_API_TOKEN` — API-токен (генерация: `$JENKINS_URL/me/configure`)

> В отличие от `gh` / `glab` / `kubectl`, плагин использует REST API напрямую через `curl` — отдельного CLI-бинаря ставить не нужно. Достаточно `curl` и `jq` (есть в большинстве дистрибутивов).

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — общий гайд по CLI-утилитам и матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-jenkins-cli@dex-claude-marketplace
```
