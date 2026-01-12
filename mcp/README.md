# MCP Server Catalog

Централизованный каталог MCP (Model Context Protocol) серверов для всех плагинов Claude Code Marketplace.

## Быстрый старт

1. Откройте `mcp-template.json`
2. Скопируйте содержимое в `.mcp.json` вашего проекта
3. Удалите ненужные серверы (оставьте только те, что нужны для вашей роли)
4. Удалите поля `_description`, `_env`, `_note` из каждого сервера
5. Настройте переменные окружения в `.env` (см. `run-claude/sample.env`)
6. Запустите Claude Code и проверьте: `/mcp list`

## MCP серверы по плагинам

| Плагин | Required | Optional |
|--------|----------|----------|
| **dex-product-manager** | notion | - |
| **dex-system-analyst** | pdf-reader | notion, google-drive |
| **dex-dotnet-developer** | gitlab, notion | genai-toolbox (databases), rabbitmq, kafka, docker, seq, kubernetes, teamcity, grafana, openapi |
| **dex-dotnet-architect** | github, gitlab, notion | filesystem |
| **dex-python-ml-developer** | gitlab | notion, mlflow, wandb, huggingface |
| **dex-quality-assurance** | gitlab | filesystem |
| **dex-devops** | gitlab | - |

## Описание серверов

### Документация и управление проектами

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **notion** | Notion workspace - документация, база знаний | `NOTION_TOKEN` |
| **pdf-reader** | Чтение и анализ PDF документов | - |
| **google-drive** | Google Docs, Sheets, Slides | `GOOGLE_DRIVE_OAUTH_CREDENTIALS` |

### Version Control и CI/CD

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **gitlab** | GitLab - repos, issues, MRs, CI/CD | `GITLAB_TOKEN`, `GITLAB_API_URL` |
| **github** | GitHub - repos, issues, PRs, actions | `GITHUB_TOKEN` |
| **teamcity** | TeamCity - builds, agents, test analysis (~77 tools) | `TEAMCITY_URL`, `TEAMCITY_TOKEN`, `MCP_MODE` |

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
| **rabbitmq** | RabbitMQ - очереди сообщений | `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` |
| **kafka** | Apache Kafka - topics, consumers, consumer groups | `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_SASL_*` |
| **seq** | Seq - structured logging | `SEQ_SERVER_URL`, `SEQ_API_KEY` |

**Kafka MCP:** Go бинарник через Homebrew (`brew tap tuannvm/mcp && brew install kafka-mcp-server`).
Поддержка SASL (plain, scram-sha-256, scram-sha-512) и TLS. [Docs](https://github.com/tuannvm/kafka-mcp-server)

### Контейнеры и оркестрация

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **docker** | Docker - containers, images | - |
| **kubernetes** | K8s - pods, deployments | `K8S_READONLY` |
| **filesystem** | Локальные файлы (настройте пути) | - |

### Мониторинг и API

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **grafana** | Grafana - dashboards, Prometheus metrics, Loki logs | `GRAFANA_URL`, `GRAFANA_API_KEY` |
| **openapi** | OpenAPI/Swagger - API documentation generation | - |

### ML/AI инструменты

| Сервер | Описание | Переменные |
|--------|----------|------------|
| **mlflow** | Experiment tracking, model registry | `MLFLOW_TRACKING_URI` |
| **wandb** | Weights & Biases visualizations | `WANDB_API_KEY` |
| **huggingface** | HuggingFace models и datasets | `HUGGINGFACE_TOKEN` |

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
      "command": "uvx",
      "args": ["mcp-server-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${GITLAB_TOKEN}",
        "GITLAB_API_URL": "${GITLAB_API_URL:-https://gitlab.com/api/v4}"
      }
    }
  }
}
```

### Для .NET Developer (с genai-toolbox)

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "uvx",
      "args": ["mcp-server-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${GITLAB_TOKEN}",
        "GITLAB_API_URL": "${GITLAB_API_URL:-https://gitlab.com/api/v4}"
      }
    },
    "genai-toolbox": {
      "command": "npx",
      "args": ["-y", "@anthropic/toolbox-sdk", "--tools-file", "tools.yaml"]
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
      "command": "npx",
      "args": ["-y", "@grafana/mcp-grafana"],
      "env": {
        "GRAFANA_URL": "${GRAFANA_URL:-http://localhost:3000}",
        "GRAFANA_API_KEY": "${GRAFANA_API_KEY}"
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
