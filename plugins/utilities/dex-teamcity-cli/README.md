# dex-teamcity-cli

CLI-утилита для TeamCity. Builds, agents, logs — через официальный [TeamCity CLI](https://github.com/JetBrains/teamcity-cli) от JetBrains (Go-binary, бинарь `teamcity`).

## Команды

| Команда | Описание |
|---------|----------|
| `/tc-builds` | Список билдов, детали конкретного билда |
| `/tc-agents` | Статус агентов и pools |
| `/tc-logs` | Build log (опц. live `--watch`) |

## Требования

- [`teamcity`](https://github.com/JetBrains/teamcity-cli) CLI в `PATH`
- Авторизация через `teamcity auth login` (interactive, multi-server) или env `TEAMCITY_URL` + `TEAMCITY_TOKEN`

## Установка CLI

```bash
# macOS
brew install jetbrains/utils/teamcity

# Linux — официальный установщик от JetBrains
curl -fsSL https://jb.gg/tc/install | bash

# npm (cross-platform)
npm install -g @jetbrains/teamcity-cli

# Go install (нужен Go toolchain)
go install github.com/JetBrains/teamcity-cli/tc@latest

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh teamcity
```

Первая авторизация:

```bash
teamcity auth login         # interactive — вставите URL и token
teamcity auth status        # проверка
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — multi-server, SSO/SAML, scripting через JSON-output, матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-teamcity-cli@dex-claude-marketplace
```

## Безопасность

- Все команды read-only (`run list`, `agent list`, `run log`). Деструктивные (`run cancel`, `agent disable`, `pipeline push`) намеренно не обёрнуты — выполняются вручную.
- Token хранится в `~/.config/teamcity/` (управляется CLI), `chmod 600` рекомендован.

## Breaking changes (2.0.0)

- Раньше плагин использовал REST API через `curl` — теперь полноценный JetBrains CLI с auth-flow, real-time log streaming (`run watch`), доступом ко всем командам (`teamcity api` для raw REST как fallback).
- Env-переменные `TEAMCITY_URL` / `TEAMCITY_TOKEN` остаются, но предпочтительный способ — `teamcity auth login`.
