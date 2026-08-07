# MCP Server Catalog

Централизованный каталог MCP (Model Context Protocol) серверов для всех плагинов Claude Code Marketplace.

> **Когда CLI вместо MCP.** Для read-only диагностики (PostgreSQL / Redis / Kafka / Kubernetes / GitHub / GitLab) часто достаточно CLI-плагинов из `plugins/utilities/dex-*-cli/` - они легче, не требуют отдельного сервера и используют существующий CLI-auth. MCP-серверы остаются предпочтительным выбором для автономных агентских workflow со сложной логикой. Decision matrix и сравнение покрытия - см. [`docs/CLI_UTILITIES.md`](../docs/CLI_UTILITIES.md#cli-vs-mcp-матрица-решений).

## Быстрый старт

1. Откройте `mcp-template.json`
2. Скопируйте содержимое в `.mcp.json` вашего проекта
3. Удалите ненужные серверы (оставьте только те, что нужны для вашей роли)
4. Удалите поля `_description`, `_env`, `_note` из каждого сервера
5. Настройте переменные окружения в `.env` (см. `run-claude/sample.env`)
6. Запустите Claude Code и проверьте: `/mcp list`

HTTP-серверы в `.mcp.json` копировать не нужно - для них есть регистратор `run-claude/register-http-mcp.sh` (раньше это делал лаунчер `run-claude` на каждом запуске):

```bash
cd run-claude
./register-http-mcp.sh --dry-run     # показать команды, токены скрыты
./register-http-mcp.sh               # conflu и jira из *_MCP_URL / *_MCP_TOKEN
./register-http-mcp.sh --name gitlab --url https://gitlab.com/api/v4/mcp
./register-http-mcp.sh --name sentry --url https://mcp.sentry.dev/mcp --token "$SENTRY_TOKEN" --auth-scheme Bearer
```

Скрипт лежит рядом с лаунчером и подхватывает соседний `run-claude/.env` автоматически; другой файл - `-e <путь>`. Windows-зеркало - `run-claude/register-http-mcp.ps1` с теми же параметрами в PowerShell-форме (`-DryRun`, `-EnvFile`, `-Name`, ...).

Без `--name/--url` скрипт берёт пары `CONFLUENCE_MCP_URL` + `CONFLUENCE_MCP_TOKEN` и `JIRA_MCP_URL` + `JIRA_MCP_TOKEN`: полностью пустая пара пропускается, половина пары - ошибка (молча зарегистрировать сервер без авторизации нельзя). Повторная регистрация - `--force`. Полный список опций - `./register-http-mcp.sh --help`.

Область по умолчанию - `user`: запись ложится в `~/.claude.json`, видна во всех проектах и не зависит от каталога, из которого запущен скрипт. Это соответствует тому, как `run-claude/README.md` описывает `CONFLUENCE_MCP_*` и `JIRA_MCP_*` - глобальные, единые для всех проектов. Для `--scope project` и `--scope local` скрипт сам уходит в корень проекта (каталог над `run-claude`), потому что обе эти области привязаны к рабочему каталогу, а лаунчер запускает `claude` именно оттуда. Токен Claude Code хранит открытым текстом в любой области: в `~/.claude.json` или в `.mcp.json`. Разница в том, что при `--scope project` файл лежит внутри репозитория проекта - его добавляют в `.gitignore`.

## Требования по платформам (Linux / macOS)

Сами серверы каталога запускаются одинаково на Linux и macOS: в конфиге нет путей или команд, привязанных к ОС. Различается только то, что должно стоять заранее:

- **npx-серверы** (github, notion, kubernetes, playwright, sentry, teamcity, elasticsearch, pdf-reader, google-drive, huggingface, openapi, filesystem, chrome-devtools, gitlab_community, genai-toolbox для БД): нужен Node.js. Linux - `setup/npx-install/install.sh`; macOS - `brew install node`.
- **uvx-серверы** (atlassian, rabbitmq, docker, grafana, mlflow, wandb): нужен uv. Linux и macOS - `setup/uvx-install/install.sh` (установщик uv кросс-платформенный). Все они запускаются через `uvx`, то есть в изолированном окружении: от python-проекта, в каталоге которого стартует сервер, они не зависят.
- **HTTP-серверы** (gitlab): ставить нечего, транспорт `http` идёт напрямую в endpoint инстанса; аутентификация - OAuth при первом подключении.
- **Бинарные серверы**:
  - `kafka` (`kafka-mcp-server`, Go-бинарь): macOS - `brew tap tuannvm/mcp && brew install kafka-mcp-server`; Linux - бинарь из [github.com/tuannvm/kafka-mcp-server](https://github.com/tuannvm/kafka-mcp-server). Должен быть в `PATH`.
  - `seq` (`seq-mcp-server`): ставится отдельно из источника сервера, бинарь в `PATH`. Отдельной macOS-специфики нет.
- **google-drive**: путь OAuth-кредов по умолчанию (`~/.config/...`) валиден и на macOS - тильда раскрывается, каталог создаётся самим сервером, менять под macOS не нужно.

Apple Silicon (arm64): MCP-слой ограничений не добавляет - серверы это Node / Python / Go-пакеты с arm64-сборками. Ограничения arm64 касаются только отдельных CLI-бинарей диагностики (см. [docs/CLI_UTILITIES.md](../docs/CLI_UTILITIES.md)), не MCP.

## MCP серверы по плагинам

| Плагин | Required | Optional |
|--------|----------|----------|
| **dex-product-manager** | notion | - |
| **dex-system-analyst** | pdf-reader | notion, google-drive |
| **dex-dotnet-developer** | gitlab, notion | genai-toolbox (databases), rabbitmq, kafka, docker, seq, kubernetes, teamcity, grafana, openapi |
| **dex-dotnet-architect** | github, gitlab, notion | filesystem |
| **dex-python-ml-developer** | gitlab | notion, mlflow, wandb, huggingface |
| **dex-quality-assurance** | gitlab | playwright, filesystem |
| **dex-devops** | gitlab | - |

## Описание серверов

### Документация и управление проектами

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **notion** | Notion workspace - документация, база знаний | `NOTION_TOKEN` |
| **atlassian** | Jira и Confluence - задачи, JQL, спринты, страницы вики | `JIRA_URL` + `JIRA_PERSONAL_TOKEN` (Server/DC) или `JIRA_USERNAME` + `JIRA_API_TOKEN` (Cloud); те же пары с префиксом `CONFLUENCE_` |
| **pdf-reader** | Чтение и анализ PDF документов | - |
| **google-drive** | Google Docs, Sheets, Slides | `GOOGLE_DRIVE_OAUTH_CREDENTIALS` |

**Atlassian MCP:** один сервер (`mcp-atlassian`) обслуживает Jira и Confluence - незаданный блок переменных отключает соответствующий продукт. Работает это только потому, что взаимоисключающие переменные записаны в шаблоне формой `${VAR:-}`: голая `${VAR}` у незаданной переменной приезжает в сервер текстом `${VAR}`, и продукт остаётся включённым с мусорными значениями. Тип развёртывания определяется по URL: Cloud (`*.atlassian.net`) - username + API-токен, Server/DC - Personal Access Token. Версия запинена (`mcp-atlassian==0.23.0`), потому что имена tools меняются между релизами. Сужение поверхности: `ATLASSIAN_READ_ONLY=true`, `JIRA_PROJECTS_FILTER`, `CONFLUENCE_SPACES_FILTER`, `ENABLED_TOOLS`. [Docs](https://github.com/sooperset/mcp-atlassian)

Для read-only работы с задачами из терминала есть более лёгкий путь - CLI-плагин `dex-jira-cli` (`jira` от ankitpokhrel), см. [docs/CLI_UTILITIES.md](../docs/CLI_UTILITIES.md).

### Version Control и CI/CD

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **gitlab** | GitLab - repos, issues, MRs, CI/CD. Нативный сервер инстанса | `GITLAB_URL` (токена нет - OAuth) |
| **gitlab_community** | То же через `@zereight/mcp-gitlab` - для инстансов до 18.6 или без Duo | `GITLAB_TOKEN`, `GITLAB_API_URL` |
| **github** | GitHub - repos, issues, PRs, actions | `GITHUB_TOKEN` |
| **teamcity** | TeamCity - builds, agents, test analysis (~77 tools) | `TEAMCITY_URL`, `TEAMCITY_TOKEN`, `MCP_MODE` |

**GitLab MCP:** нативный сервер отдаётся самим инстансом по `https://<host>/api/v4/mcp` (beta с GitLab 18.6, протоколы `2025-03-26` и `2025-06-18` - с 18.7). Требует включённого GitLab Duo и разрешённого доступа к MCP; аутентификация - OAuth 2.0 Dynamic Client Registration при первом подключении (`/mcp` в чате), PAT не используется. Инстанс старее 18.6 или без Duo - запись `gitlab_community` на PAT. [Docs](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)

### Базы данных (genai-toolbox)

| Сервер | Описание | Конфигурация |
|--------|----------|--------------|
| **genai-toolbox** | Universal Database MCP | `tools.yaml` |

**Поддерживаемые базы данных:**
- PostgreSQL (+ AlloyDB, Cloud SQL)
- MongoDB
- Elasticsearch
- Redis
- MySQL, SQL Server
- BigQuery, ClickHouse
- Oracle, Cloud Spanner, Firestore

**Настройка:** Создайте `tools.yaml` в корне проекта. Пример: [`mcp/examples/toolbox-config.yaml`](examples/toolbox-config.yaml)

**Docs:** https://github.com/googleapis/genai-toolbox

### Message Queues и Logging

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **rabbitmq** | RabbitMQ - очереди, exchanges, bindings | Через MCP tool |
| **kafka** | Apache Kafka - topics, consumers, consumer groups | `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_SASL_*` |
| **seq** | Seq - structured logging | `SEQ_SERVER_URL`, `SEQ_API_KEY` |

**RabbitMQ MCP:** Подключение через tool `rabbitmq_broker_initialize_connection(hostname, username, password, port=5672, use_tls=False)`.
[Docs](https://github.com/amazon-mq/mcp-server-rabbitmq)

**Kafka MCP:** Go бинарник через Homebrew (`brew tap tuannvm/mcp && brew install kafka-mcp-server`).
Поддержка SASL (plain, scram-sha-256, scram-sha-512) и TLS. [Docs](https://github.com/tuannvm/kafka-mcp-server)

### Контейнеры и оркестрация

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **docker** | Docker - containers, images | - |
| **kubernetes** | K8s - pods, deployments | `K8S_READONLY` |
| **filesystem** | Локальные файлы (настройте пути) | - |

### Browser automation и E2E

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **playwright** | Playwright MCP - browser automation, E2E checks, accessibility tree navigation (Microsoft official) | - |
| **chrome-devtools** | Chrome DevTools - debugging, testing, screenshots, headed/isolated | - |

Playwright MCP даёт агенту высокоуровневые операции: snapshot accessibility tree, click/fill/select по role+name, navigate, evaluate. Подходит для автономного E2E-workflow ("проверь форму регистрации"). Для запуска уже написанных Playwright-тестов и просмотра отчётов -- CLI-плагин `dex-playwright-cli`.

**Перед первым запуском.** MCP не ставит браузеры автоматически: `npx playwright install chromium` (или другой движок из списка ниже).

**Флаги аргументов `@playwright/mcp`:**

| Флаг | Зачем |
|---|---|
| `--isolated` | Свежий профиль на сессию, ничего не персистится между запусками. |
| `--headless` | Headless-режим (нужен для CI / WSL без GUI). По умолчанию MCP стартует headed. Для headed-режима -- убрать флаг и обеспечить X-сервер / WSLg. |
| `--browser <name>` | `chromium` (дефолт) \| `firefox` \| `webkit` \| `chrome` \| `msedge`. |
| ~~`--port`~~ | **НЕ указывать** -- переключает транспорт на HTTP/SSE; Claude Code требует stdio (дефолт). |

### Мониторинг и API

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **grafana** | Grafana - dashboards, Prometheus metrics, Loki logs | `GRAFANA_URL`, `GRAFANA_SERVICE_ACCOUNT_TOKEN` |
| **sentry** | Sentry - error tracking, issues, stack traces, releases | `SENTRY_ACCESS_TOKEN`, `SENTRY_HOST` |
| **openapi** | OpenAPI/Swagger - API documentation generation | - |

### ML/AI инструменты

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **mlflow** | Experiment tracking, model registry | `MLFLOW_TRACKING_URI`, `MLFLOW_MCP_TOOLS` |
| **wandb** | Weights & Biases visualizations | `WANDB_API_KEY`, `WANDB_BASE_URL` |
| **huggingface** | HuggingFace models и datasets | `HF_TOKEN` |

Отдельных пакетов у части этих серверов нет: **mlflow** идёт внутри самого `mlflow` (extra `mcp`, требуется версия >= 3.5.1), **wandb** ставится из git-репозитория (в PyPI/npm не публикуется), **huggingface** публикуется в npm под скоупом `@llmindset` из репозитория `huggingface/hf-mcp-server`. У wandb и huggingface есть hosted-альтернативы без локального запуска (`https://mcp.withwandb.com/mcp`, `https://huggingface.co/mcp`).

## Пример настройки

### Для Product Manager

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}"
      }
    }
  }
}
```

### Для DevOps

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "http",
      "url": "${GITLAB_URL:-https://gitlab.com}/api/v4/mcp"
    }
  }
}
```

### Для .NET Developer (с genai-toolbox)

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "http",
      "url": "${GITLAB_URL:-https://gitlab.com}/api/v4/mcp"
    },
    "atlassian": {
      "command": "uvx",
      "args": ["--from", "mcp-atlassian==0.23.0", "mcp-atlassian"],
      "env": {
        "JIRA_URL": "${JIRA_URL}",
        "JIRA_PERSONAL_TOKEN": "${JIRA_PERSONAL_TOKEN}"
      }
    },
    "genai-toolbox": {
      "command": "npx",
      "args": ["-y", "@toolbox-sdk/server", "--tools-file", "tools.yaml", "--stdio"]
    },
    "teamcity": {
      "command": "npx",
      "args": ["-y", "@daghis/teamcity-mcp"],
      "env": {
        "TEAMCITY_URL": "${TEAMCITY_URL}",
        "TEAMCITY_TOKEN": "${TEAMCITY_TOKEN}",
        "MCP_MODE": "${MCP_MODE:-dev}"
      }
    },
    "grafana": {
      "command": "uvx",
      "args": ["mcp-grafana"],
      "env": {
        "GRAFANA_URL": "${GRAFANA_URL:-http://localhost:3000}",
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": "${GRAFANA_SERVICE_ACCOUNT_TOKEN}"
      }
    }
  }
}
```

**Примечание:** Для genai-toolbox создайте `tools.yaml` с конфигурацией баз данных.
См. пример: [`mcp/examples/toolbox-config.yaml`](examples/toolbox-config.yaml)

## Настройка переменных окружения

Все переменные описаны в `run-claude/sample.env`. Скопируйте его в `.env` и заполните нужные значения:

```bash
cp run-claude/sample.env .env
# Отредактируйте .env и укажите ваши токены
```

## Проверка работы

После настройки запустите Claude Code и выполните:

```bash
/mcp list
```

Вы должны увидеть список подключенных MCP серверов.

## Troubleshooting

### MCP сервер не запускается

1. Проверьте, что переменные окружения заданы: `echo $NOTION_TOKEN`
2. Проверьте логи: `claude --mcp-debug`
3. Убедитесь, что зависимости установлены (npx/uvx)

### Ошибка аутентификации

1. Проверьте токен на странице провайдера (Notion, GitLab, etc.)
2. Убедитесь, что токен имеет нужные permissions
3. Проверьте срок действия токена

## См. также

- [CREDENTIALS.md](../CREDENTIALS.md) - подробная инструкция по получению токенов
- [run-claude/sample.env](../run-claude/sample.env) - шаблон переменных окружения
