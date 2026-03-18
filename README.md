# Claude Code Marketplace

> Маркетплейс атомарных AI-плагинов для разработчиков. Один плагин = одна функция.

## О проекте

Claude Code Marketplace — набор из 93 специализированных плагинов для Claude Code, организованных в 3 уровня:

```
Level 3: BUNDLES (10)     — наборы для быстрой установки по ролям
Level 2: SPECIALISTS (39) — агенты с узкой специализацией
Level 1: SKILLS (42)      — базы знаний (автоматическая активация)
         UTILITIES (2)     — инструменты (hooks, notifications)
```

**Принцип:** атомарные плагины без дублирования. Собирай свой набор из нужных компонентов.

## Быстрый старт

### Установка бандлом (рекомендуется)

```bash
# Клонируйте репозиторий
git clone https://github.com/dex-it/claude-code-marketplace.git
cd claude-code-marketplace

# Посмотреть доступные бандлы
./install-bundle/install-bundle.sh --list

# Установить бандл
./install-bundle/install-bundle.sh dotnet-developer

# Предпросмотр без установки
./install-bundle/install-bundle.sh dotnet-developer --dry-run

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 dotnet-developer
```

### Установка отдельных плагинов

```bash
# Установить specialist
claude plugins install github:dex-it/claude-code-marketplace/plugins/specialists/dotnet/dex-dotnet-coder

# Установить skill
claude plugins install github:dex-it/claude-code-marketplace/plugins/skills/dex-skill-dotnet-patterns

# Установить utility
claude plugins install github:dex-it/claude-code-marketplace/plugins/utilities/dex-telegram-notifier
```

### Удаление

```bash
# Удалить бандл
./install-bundle/uninstall-bundle.sh dotnet-developer

# Удалить отдельный плагин
claude plugins uninstall dex-dotnet-coder
```

## Бандлы (Level 3)

Мета-плагины для установки наборов. Не содержат кода — только список компонентов.

| Bundle | Описание | Компонентов |
|--------|----------|-------------|
| `dotnet-developer` | .NET разработчик | 12 |
| `dotnet-fullstack` | .NET + инфраструктура | 29 |
| `ts-fullstack` | TypeScript fullstack (Node.js/Bun + React) | 7 |
| `devops` | DevOps инженер | 11 |
| `product-manager` | Product Manager | 9 |
| `system-analyst` | Системный аналитик | 9 |
| `architect` | Архитектор | 9 |
| `qa-engineer` | QA инженер | 6 |
| `ml-engineer` | ML инженер | 11 |
| `infrastructure` | Вся инфраструктура | 23 |

Подробнее: [install-bundle/README.md](./install-bundle/README.md)

## Specialists (Level 2)

Агенты с узкой специализацией. Один агент = один плагин.

### Fullstack (1)

| Плагин | Агент | Описание |
|--------|-------|----------|
| dex-ts-fullstack-coder | ts-fullstack-assistant | TypeScript fullstack: Node.js/Bun + React |

### .NET (6)

| Плагин | Агент | Описание |
|--------|-------|----------|
| dex-dotnet-coder | coding-assistant | Написание кода, SOLID, паттерны |
| dex-dotnet-debugger | bug-hunter | Отладка, root cause analysis |
| dex-dotnet-reviewer | code-reviewer | Code review, security |
| dex-dotnet-tester | test-writer | Unit тесты, xUnit, Moq |
| dex-ef-specialist | ef-specialist | EF Core: migrations, queries, DbContext |
| dex-dotnet-performance | performance-analyst | Profiling, N+1, memory |

### Infrastructure (12)

| Плагин | Описание |
|--------|----------|
| dex-postgresql-specialist | PostgreSQL: queries, indexes, optimization |
| dex-mongodb-specialist | MongoDB: queries, aggregation pipeline |
| dex-rabbitmq-specialist | RabbitMQ: queues, exchanges, MassTransit |
| dex-kafka-specialist | Kafka: topics, consumers, partitions |
| dex-elasticsearch-specialist | Elasticsearch: indexing, searching |
| dex-redis-specialist | Redis: caching, pub/sub |
| dex-docker-specialist | Docker: images, containers, compose |
| dex-kubernetes-specialist | Kubernetes: deployments, services, HPA |
| dex-cicd-gitlab | GitLab CI/CD: pipelines, deployment |
| dex-cicd-teamcity | TeamCity: build configurations |
| dex-logging-seq | Seq: log analysis, dashboards |
| dex-monitoring-grafana | Grafana: dashboards, alerts, metrics |

### Architecture (4)

| Плагин | Описание |
|--------|----------|
| dex-architect | System design, patterns, trade-offs |
| dex-adr-writer | Architecture Decision Records |
| dex-diagram-creator | C4, sequence diagrams, Mermaid |
| dex-api-designer | REST API design, OpenAPI |

### Product (4)

| Плагин | Описание |
|--------|----------|
| dex-business-analyst | Requirements, BRD |
| dex-roadmap-planner | Strategic planning |
| dex-backlog-manager | Epic backlog, prioritization |
| dex-pm-metrics-analyst | KPIs, OKRs, metrics |

### System Analysis (4)

| Плагин | Описание |
|--------|----------|
| dex-requirements-analyst | Requirements analysis, validation |
| dex-user-story-writer | User stories, acceptance criteria |
| dex-process-modeler | BPMN, workflows |
| dex-doc-writer | Technical specs, API docs |

### QA (3)

| Плагин | Описание |
|--------|----------|
| dex-test-analyst | Test design, coverage analysis |
| dex-test-automator | Selenium, Playwright, API testing |
| dex-bug-reporter | Bug reports, reproduction steps |

### ML (5)

| Плагин | Описание |
|--------|----------|
| dex-ml-experimenter | EDA, feature engineering |
| dex-model-trainer | PyTorch, TensorFlow, sklearn |
| dex-model-debugger | Debugging ML models |
| dex-ml-deployer | ONNX, TFLite, FastAPI |
| dex-data-pipeline | Data loading, preprocessing |

## Skills (Level 1)

Базы знаний — активируются автоматически по ключевым словам в контексте. 42 skills по категориям:

| Категория | Skills |
|-----------|--------|
| **.NET** | dotnet-patterns, ef-core, async-patterns, linq-optimization, api-development, api-documentation, testing-patterns |
| **Frontend & TypeScript** | react, typescript-patterns, nodejs-api |
| **Security** | owasp-security |
| **Workflow** | git-workflow |
| **Infrastructure** | rabbitmq, kafka, elasticsearch, redis, mongodb, docker, kubernetes, gitlab-ci, teamcity, logging, observability |
| **Architecture** | clean-architecture, ddd, microservices |
| **Product & Analysis** | agile, user-stories, bpmn, doc-standards, api-specification, epic-planning, product-discovery, prioritization |
| **QA** | test-design, api-testing |
| **ML** | pytorch, tensorflow, classical-ml, nlp-transformers, computer-vision, ml-optimization |

## Utilities (Level 1)

| Плагин | Описание |
|--------|----------|
| dex-telegram-notifier | Telegram уведомления о событиях Claude Code |
| dex-discord-notifier | Discord уведомления о событиях Claude Code |

## MCP Servers

MCP конфигурации в каталоге `mcp/`. Подробнее: [mcp/README.md](./mcp/README.md)

| Роль | Required | Optional |
|------|----------|----------|
| .NET Developer | gitlab | postgres, rabbitmq, kafka, docker, seq, kubernetes |
| Architect | github, gitlab | notion, filesystem |
| DevOps | gitlab | docker, kubernetes |
| Product Manager | notion | — |
| System Analyst | pdf-reader | notion, google-drive |
| QA Engineer | gitlab | filesystem |
| ML Engineer | gitlab | mlflow, wandb, huggingface |

Настройка credentials: [CREDENTIALS.md](./CREDENTIALS.md)

## Структура проекта

```
claude-code-marketplace/
├── plugins/
│   ├── skills/                    # Level 1: базы знаний (42)
│   │   ├── dex-skill-agile/
│   │   ├── dex-skill-dotnet-patterns/
│   │   └── ...
│   ├── utilities/                 # Level 1: инструменты (2)
│   │   └── dex-telegram-notifier/
│   ├── specialists/               # Level 2: агенты (39)
│   │   ├── dotnet/               # 6 specialists
│   │   ├── fullstack/            # 1 specialist
│   │   ├── infrastructure/       # 12 specialists
│   │   ├── architecture/         # 4 specialists
│   │   ├── product/              # 8 specialists
│   │   ├── qa/                   # 3 specialists
│   │   └── ml/                   # 5 specialists
│   └── bundles/                   # Level 3: наборы (10)
│       ├── dex-bundle-dotnet-developer/
│       └── ...
├── install-bundle/                # Скрипты установки/удаления
├── mcp/                           # MCP server конфигурации
├── run-claude/                    # Конфигурация запуска
├── .claude-plugin/
│   └── marketplace.json           # Каталог всех плагинов
├── CLAUDE.md
├── CREDENTIALS.md
└── README.md
```

## Требования

- **Claude Code** — latest version
- **jq** — для install скриптов (Linux/macOS)
- **Credentials** — API ключи для MCP интеграций (см. [CREDENTIALS.md](./CREDENTIALS.md))

## Contributing

1. Fork репозиторий
2. Создайте ветку (`git checkout -b feature/new-plugin`)
3. Следуйте структуре плагинов (см. [CLAUDE.md](./CLAUDE.md))
4. Создайте Pull Request

### Конвенции именования

- **Skills**: `dex-skill-{name}`
- **Specialists**: `dex-{domain}-{role}` или `dex-{name}-specialist`
- **Bundles**: `dex-bundle-{role}`

## License

GPL v3.0 — см. [LICENSE](./LICENSE)

---

**DEX Team** · Version 5.0.0
