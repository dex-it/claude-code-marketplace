# dex-jira-cli

CLI-утилита для Jira. Задачи, поиск по JQL, спринты - через `jira` (ankitpokhrel/jira-cli), read-only.

## Команды

| Команда | Описание |
|---------|----------|
| `/jira-issue` | Детали задачи: ТЗ, критерии приёмки, статус, связи |
| `/jira-list` | Поиск задач по JQL (плоский вывод) |
| `/jira-sprint` | Задачи текущего или указанного спринта |

## Требования

- [`jira`](https://github.com/ankitpokhrel/jira-cli) в `PATH`, настроенный доступ (`jira init`)
- API-токен в `JIRA_API_TOKEN`; для self-hosted Jira Server/DC - `JIRA_AUTH_TYPE=bearer` с PAT

## Установка CLI

```bash
# Homebrew (macOS / Linux)
brew tap ankitpokhrel/jira-cli
brew install jira-cli

# Бинарь из релизов (официальный источник)
# https://github.com/ankitpokhrel/jira-cli/releases

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh jira
```

## Конфигурация

`jira init` создаёт конфиг (по умолчанию `~/.config/.jira/.config.yml`; путь переопределяется `JIRA_CONFIG_FILE` или флагом `--config`). Тип авторизации:

- Jira Cloud: `JIRA_AUTH_TYPE=basic` (по умолчанию), email + API-токен
- Jira Server / Data Center (self-hosted): `JIRA_AUTH_TYPE=bearer`, Personal Access Token в `JIRA_API_TOKEN`

## Безопасность

- Использовать токен / учётку с read-only правами на проект: только просмотр задач, без перехода статусов и правок.
- Все три команды утилиты read-only (view / list / sprint list); create / edit / move / delete в утилите не оборачиваются.
- Токен не коммитить и не печатать в чат; хранить в env или секрет-менеджере.

## Установка плагина

```bash
claude plugins install dex-jira-cli@dex-claude-marketplace
```
