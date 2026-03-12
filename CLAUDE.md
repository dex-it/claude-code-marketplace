# Claude Code Marketplace v5.0

## О проекте

Маркетплейс атомарных AI-плагинов для разработчиков. Каждый плагин имеет узкую специализацию: один плагин = одна функция.

**Концепция:** Атомарные плагины без дублирования. Собирай свой набор из нужных компонентов.

## Архитектура: 3 уровня

```
Level 3: BUNDLES (Наборы)
├── Мета-плагины для удобства
├── Документация какие плагины установить
└── Не содержат кода, только manifest

Level 2: SPECIALISTS (Специалисты)
├── Один агент с узкой специализацией
├── Связанные команды
└── Могут использовать skills

Level 1: SKILLS + UTILITIES (Базовый уровень)
├── Skills: базы знаний (активируются автоматически)
└── Utilities: инструменты (hooks, notifications)
```

## Структура проекта

```
claude-code-marketplace/
├── .claude-plugin/
│   └── marketplace.json           # Каталог всех 88 плагинов
├── mcp/                           # Централизованный каталог MCP серверов
│   ├── README.md
│   └── mcp-template.json
├── plugins/
│   ├── skills/                    # Level 1: Knowledge bases (40 плагинов)
│   │   ├── dex-skill-agile/
│   │   ├── dex-skill-dotnet-patterns/
│   │   ├── dex-skill-docker/
│   │   └── ...
│   ├── utilities/                 # Level 1: Tools (1 плагин)
│   │   └── dex-telegram-notifier/
│   ├── specialists/               # Level 2: Agents (38 плагинов)
│   │   ├── dotnet/               # .NET specialists (6)
│   │   ├── infrastructure/       # Infrastructure specialists (12)
│   │   ├── architecture/         # Architecture specialists (4)
│   │   ├── product/              # Product & SA specialists (8)
│   │   ├── qa/                   # QA specialists (3)
│   │   └── ml/                   # ML specialists (5)
│   └── bundles/                   # Level 3: Meta-plugins (9 плагинов)
│       ├── dex-bundle-dotnet-developer/
│       ├── dex-bundle-devops/
│       └── ...
├── run-claude/
├── install-bundle/                # Автоматизация установки
│   ├── install-bundle.sh         # Bash (Linux/Mac/WSL)
│   ├── install-bundle.ps1        # PowerShell (Windows)
│   └── README.md
├── CLAUDE.md
├── README.md
└── LICENSE
```

## Level 1: Skills (40 плагинов)

Skills - базы знаний, активируются автоматически по ключевым словам в контексте.

### .NET Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-dotnet-patterns | SOLID, DI, async/await, Result pattern, Repository |
| dex-skill-ef-core | Entity Framework Core: queries, migrations, performance |
| dex-skill-async-patterns | Async/await: cancellation, parallelism, ValueTask |
| dex-skill-linq-optimization | LINQ: deferred execution, materialization |
| dex-skill-api-development | REST API: versioning, error handling, DTOs |
| dex-skill-api-documentation | OpenAPI/Swagger, XML comments |
| dex-skill-testing-patterns | xUnit, Moq, Arrange-Act-Assert |

### Frontend Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-react | React: hooks, components, state management, performance |

### Security Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-owasp-security | OWASP: auth bypass, IDOR, injection, XSS, privilege escalation |

### Workflow Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-git-workflow | Git: branching, conventional commits, code review, MR |

### Infrastructure Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-rabbitmq | RabbitMQ: exchanges, queues, MassTransit, dead-letter |
| dex-skill-kafka | Kafka: producers, consumers, partitioning, exactly-once |
| dex-skill-elasticsearch | Elasticsearch: indexing, searching, aggregations, NEST |
| dex-skill-redis | Redis: caching, pub/sub, StackExchange.Redis |
| dex-skill-mongodb | MongoDB: documents, queries, indexes, aggregation |
| dex-skill-docker | Docker: multi-stage builds, security, compose |
| dex-skill-kubernetes | Kubernetes: deployments, services, HPA, probes, Helm |
| dex-skill-gitlab-ci | GitLab CI/CD: pipelines, jobs, artifacts |
| dex-skill-teamcity | TeamCity: build configurations, pipelines |
| dex-skill-logging | Logging: Serilog, structured logging, Seq |
| dex-skill-observability | Observability: OpenTelemetry, metrics, tracing |

### Architecture Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-clean-architecture | Clean Architecture: layers, dependencies |
| dex-skill-ddd | DDD: aggregates, entities, value objects, bounded contexts |
| dex-skill-microservices | Microservices: decomposition, communication, saga |

### Product & Analysis Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-agile | Agile: Epic/Story/Task, INVEST, DoR/DoD, sprints |
| dex-skill-user-stories | User stories: format, acceptance criteria, Given-When-Then |
| dex-skill-bpmn | BPMN: process flows, gateways, events, swimlanes |
| dex-skill-doc-standards | Documentation: BRD, PRD, ADR, Tech Specs |
| dex-skill-api-specification | API specification: OpenAPI design, contracts |
| dex-skill-epic-planning | Epic planning: decomposition, scope, dependencies |
| dex-skill-product-discovery | Product discovery: research, validation |
| dex-skill-prioritization | Prioritization: RICE, MoSCoW, scoring |

### QA Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-test-design | Test design: equivalence partitioning, boundary analysis |
| dex-skill-api-testing | API testing: REST validation, automation |

### ML Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-pytorch | PyTorch: models, training, data loading, GPU |
| dex-skill-tensorflow | TensorFlow/Keras: models, layers, callbacks |
| dex-skill-classical-ml | Classical ML: scikit-learn, XGBoost, features |
| dex-skill-nlp-transformers | NLP: HuggingFace, BERT, fine-tuning |
| dex-skill-computer-vision | Computer Vision: CNNs, classification, detection |
| dex-skill-ml-optimization | ML optimization: Optuna, Ray Tune, MLflow |

## Level 1: Utilities (1 плагин)

### dex-telegram-notifier

Telegram уведомления о событиях Claude Code.

**Функционал:**
- Уведомления при завершении работы Claude (Stop)
- Уведомления при ожидании ответа (Notification)
- Уведомления при завершении субагентов (SubagentStop)

**Команды:** `/notify-test`, `/notify-config`

**Переменные:**
- `TELEGRAM_BOT_TOKEN` - Токен бота (обязательно)
- `TELEGRAM_CHAT_ID` - ID чата (обязательно)
- `TELEGRAM_LANGUAGE` - Язык: ru/en (по умолчанию: ru)

## Level 2: Specialists (38 плагинов)

Specialists - агенты с узкой специализацией. Один агент = один плагин.

### .NET Specialists (6)

| Плагин | Агент | Описание |
|--------|-------|----------|
| dex-dotnet-coder | coding-assistant | Написание кода, SOLID, паттерны |
| dex-dotnet-debugger | bug-hunter | Отладка, root cause analysis, exceptions |
| dex-dotnet-reviewer | code-reviewer | Code review, security, best practices |
| dex-dotnet-tester | test-writer | Unit тесты, xUnit, Moq |
| dex-ef-specialist | ef-specialist | EF Core: migrations, queries, DbContext |
| dex-dotnet-performance | performance-analyst | Profiling, N+1, memory, OpenTelemetry |

### Infrastructure Specialists (12)

| Плагин | Описание |
|--------|----------|
| dex-postgresql-specialist | PostgreSQL: queries, indexes, EXPLAIN, optimization |
| dex-mongodb-specialist | MongoDB: queries, indexes, aggregation pipeline |
| dex-rabbitmq-specialist | RabbitMQ: queues, exchanges, consumers, MassTransit |
| dex-kafka-specialist | Kafka: topics, producers, consumers, partitions |
| dex-elasticsearch-specialist | Elasticsearch: indexing, searching, aggregations |
| dex-redis-specialist | Redis: caching, pub/sub, data structures |
| dex-docker-specialist | Docker: images, containers, compose, optimization |
| dex-kubernetes-specialist | Kubernetes: deployments, services, HPA, troubleshooting |
| dex-cicd-gitlab | GitLab CI/CD: pipelines, jobs, deployment |
| dex-cicd-teamcity | TeamCity: build configurations, pipelines |
| dex-logging-seq | Seq: queries, dashboards, alerts, structured logs |
| dex-monitoring-grafana | Grafana: dashboards, alerts, metrics |

### Architecture Specialists (4)

| Плагин | Описание |
|--------|----------|
| dex-architect | System design, patterns, trade-offs |
| dex-adr-writer | Architecture Decision Records |
| dex-diagram-creator | C4, sequence diagrams, Mermaid, PlantUML |
| dex-api-designer | REST API design, OpenAPI, versioning |

### Product Specialists (4)

| Плагин | Описание |
|--------|----------|
| dex-business-analyst | Requirements formalization, BRD |
| dex-roadmap-planner | Strategic planning, quarterly goals |
| dex-backlog-manager | Epic-level backlog, prioritization |
| dex-pm-metrics-analyst | KPIs, OKRs, success metrics |

### System Analyst Specialists (4)

| Плагин | Описание |
|--------|----------|
| dex-requirements-analyst | Requirements analysis, detailing, validation |
| dex-user-story-writer | User stories, acceptance criteria, Given-When-Then |
| dex-process-modeler | BPMN, workflows, process optimization |
| dex-doc-writer | Technical specs, API docs, guides |

### QA Specialists (3)

| Плагин | Описание |
|--------|----------|
| dex-test-analyst | Test design, test cases, coverage analysis |
| dex-test-automator | Selenium, Playwright, API testing |
| dex-bug-reporter | Bug reports, reproduction steps, severity |

### ML Specialists (5)

| Плагин | Описание |
|--------|----------|
| dex-ml-experimenter | EDA, feature engineering, data analysis |
| dex-model-trainer | PyTorch, TensorFlow, sklearn training |
| dex-model-debugger | Debugging ML models, error analysis |
| dex-ml-deployer | ONNX, TFLite, FastAPI, model serving |
| dex-data-pipeline | Data loading, preprocessing, optimization |

## Level 3: Bundles (9 плагинов)

Bundles - мета-плагины для удобной установки наборов. Содержат список компонентов для установки.

| Bundle | Включает |
|--------|----------|
| dex-bundle-dotnet-developer | 6 .NET specialists + 6 .NET skills |
| dex-bundle-dotnet-fullstack | dotnet-developer + 11 infrastructure specialists + skills |
| dex-bundle-devops | 6 infrastructure specialists + DevOps skills |
| dex-bundle-product-manager | 4 product specialists + PM skills |
| dex-bundle-system-analyst | 4 SA specialists + SA skills |
| dex-bundle-architect | 4 architecture specialists + architecture skills |
| dex-bundle-qa-engineer | 3 QA specialists + QA skills |
| dex-bundle-ml-engineer | 5 ML specialists + ML skills |
| dex-bundle-infrastructure | 12 infrastructure specialists + all infra skills |

## Автоматическая установка Bundles

Скрипты для установки всех компонентов бандла:

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh dotnet-developer

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 dotnet-developer

# Список всех bundles
./install-bundle/install-bundle.sh --list

# Предпросмотр без установки
./install-bundle/install-bundle.sh dotnet-developer --dry-run
```

### Алгоритм работы

1. Читает `bundle.json` из `plugins/bundles/dex-bundle-{name}/`
2. Извлекает массив `includes[]` с именами компонентов
3. Находит `source` каждого компонента в `marketplace.json`
4. Выполняет `claude plugins install {source}` для каждого
5. Выводит отчёт: установлено / пропущено / ошибки

> **Важно:** Список компонентов хранится в `bundle.json`, НЕ в `plugin.json`.
> Claude Code строго валидирует `plugin.json` и тихо ломает плагины с неизвестными полями.

### Зависимости

- **Bash**: `jq` для парсинга JSON
- **PowerShell**: встроенный `ConvertFrom-Json`

## Структура плагина

### Skill плагин
```
dex-skill-name/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── skill-name/
        └── SKILL.md
```

### Specialist плагин
```
dex-specialist-name/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── agent-name.md
└── commands/
    └── command-name.md
```

### Bundle плагин
```
dex-bundle-name/
├── .claude-plugin/
│   └── plugin.json      # Стандартный манифест (name, description, etc.)
├── bundle.json           # {"includes": ["dex-specialist-x", "dex-skill-y", ...]}
└── README.md            # Инструкция по установке компонентов
```

## Конвенции

### Именование
- **Skills**: `dex-skill-{name}`
- **Specialists**: `dex-{domain}-{role}` или `dex-{name}-specialist`
- **Bundles**: `dex-bundle-{role}`
- **Utilities**: `dex-{name}`

### Frontmatter агентов
```yaml
---
name: agent-name
description: Краткое описание для триггеров
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---
```

### Frontmatter skills
```yaml
---
name: skill-name
description: Ключевые слова для автоматической активации
allowed-tools: Read, Grep, Glob
---
```

## Технологический стек

### .NET Stack
- .NET 8.0+, async/await + CancellationToken
- Entity Framework Core, xUnit + Moq
- RabbitMQ + MassTransit, Elasticsearch + NEST
- Redis + StackExchange.Redis, Serilog + Seq
- Docker, Kubernetes, GitLab CI

### Python ML Stack
- Python 3.10+, PyTorch, TensorFlow/Keras
- scikit-learn, XGBoost, HuggingFace Transformers
- MLflow, Weights & Biases, Optuna
- ONNX, TFLite, FastAPI

## MCP Server Configuration

MCP конфигурации в централизованном каталоге `mcp/`.

### Рекомендуемые MCP по ролям

| Роль | Required | Optional |
|------|----------|----------|
| .NET Developer | gitlab | genai-toolbox, rabbitmq, kafka, docker, seq, kubernetes |
| Architect | github, gitlab | notion, filesystem |
| DevOps | gitlab | docker, kubernetes |
| Product Manager | notion | - |
| System Analyst | pdf-reader | notion, google-drive |
| QA Engineer | gitlab | filesystem |
| ML Engineer | gitlab | mlflow, wandb, huggingface |

Подробная документация: `mcp/README.md`

## Миграция с v4.0

### Было (v4.0)
8 монолитных плагинов с дублированием:
- dex-dotnet-developer (8 агентов, 17 команд, 17 skills)
- dex-dotnet-architect, dex-devops, dex-product-manager...

### Стало (v5.0)
85 атомарных плагинов без дублирования:
- 37 skills (Level 1)
- 1 utility (Level 1)
- 38 specialists (Level 2)
- 9 bundles (Level 3)

### Устраненное дублирование
- `agile-fundamentals` - было в PM и SA, теперь `dex-skill-agile`
- `doc-worker` - было в PM и SA, теперь `dex-skill-doc-standards`
- `docker-patterns` + `docker-best-practices` - теперь `dex-skill-docker`
- `k8s-patterns` + `kubernetes` - теперь `dex-skill-kubernetes`

### Как мигрировать
1. Удалите старые плагины
2. Установите нужный bundle или отдельные specialists/skills
3. Bundle содержит список компонентов в `_bundle.includes`
