# Claude Code Marketplace

## О проекте

Маркетплейс AI-агентов для разработчиков. Каждая роль в команде получает специализированного ассистента с нужными инструментами и знаниями.

**Концепция:** Плагин = Роль в команде. Установил плагин → получил всё для своей роли.

## Структура проекта

```
claude-code-marketplace/
├── .claude-plugin/
│   └── marketplace.json              # Каталог всех плагинов
├── mcp/                              # Централизованный каталог MCP серверов
│   ├── README.md                     # Документация по настройке MCP
│   └── mcp-template.json             # Все 18 MCP серверов в одном файле
├── plugins/
│   ├── dex-dotnet-developer/         # 🧑‍💻 .NET Разработчик
│   ├── dex-dotnet-architect/         # 🏗️ Архитектор
│   ├── dex-quality-assurance/        # 🧪 QA инженер
│   ├── dex-system-analyst/           # 📋 Системный аналитик
│   ├── dex-devops/                   # ⚙️ DevOps инженер
│   ├── dex-product-manager/          # 📊 Продакт-менеджер
│   └── dex-python-ml-developer/      # 🤖 Python ML Разработчик
├── run-claude/                       # Контекст выполнения
├── CLAUDE.md
├── README.md
└── LICENSE
```

## Плагины по ролям

### dex-dotnet-developer

**Для:** .NET разработчиков (Full-stack с инфраструктурой)

**Агенты (8):**
- `coding-assistant` - написание кода, SOLID, паттерны
- `bug-hunter` - поиск и исправление багов
- `code-reviewer` - code review, безопасность
- `test-writer` - генерация тестов xUnit/Moq
- `infrastructure-assistant` - PostgreSQL, MongoDB, RabbitMQ, Kafka, Redis, ES, Docker, Grafana, TeamCity
- `performance-analyst` - N+1, profiling, memory leaks, OpenTelemetry traces
- `ci-cd-specialist` - GitLab CI + TeamCity pipelines
- `api-designer` - OpenAPI/Swagger, API versioning

**Команды (17):** `/build`, `/test`, `/debug`, `/refactor`, `/ef-migration`, `/rabbit-status`, `/kafka-status`, `/es-query`, `/redis-cache`, `/docker-build`, `/logs`, `/k8s-status`, `/teamcity-status`, `/api-docs`, `/health-check`, `/metrics`, `/mongo-query`

**Skills (17):** dotnet-patterns, ef-core, async-patterns, linq-optimization, api-development, api-documentation, testing-patterns, rabbitmq-patterns, kafka-patterns, elasticsearch-patterns, redis-patterns, mongodb-patterns, docker-patterns, k8s-patterns, teamcity-patterns, logging-patterns, observability-patterns

**MCP (11):** GitLab, Notion, genai-toolbox (PostgreSQL/MongoDB/Elasticsearch/Redis), RabbitMQ, Kafka, Docker, Seq, Kubernetes, TeamCity, Grafana, OpenAPI

**CLI Fallbacks:** psql, mongosh, rabbitmqadmin, kafka-topics.sh, redis-cli, curl (ES), docker/docker-compose, kubectl/helm

---

### dex-dotnet-architect

**Для:** Архитекторов

**Агенты:**
- `architect` - проектирование архитектуры
- `adr-writer` - Architecture Decision Records
- `diagram-creator` - C4, sequence diagrams

**Команды:** `/design`, `/review`, `/adr`

**Skills:** clean-architecture, ddd-patterns, microservices

**MCP:** GitHub, GitLab, Notion

---

### dex-quality-assurance

**Для:** QA инженеров

**Агенты:**
- `test-analyst` - создание тест-кейсов
- `test-automator` - автоматизация тестов
- `bug-reporter` - баг-репорты

**Команды:** `/analyze-story`, `/create-tests`

**Skills:** test-design, api-testing

**MCP:** GitLab

---

### dex-system-analyst

**Для:** Системных аналитиков

**Агенты:**
- `requirements-analyst` - анализ и детализация требований
- `user-story-writer` - User Stories с acceptance criteria
- `process-modeler` - BPMN моделирование процессов

**Команды:** `/write-story`, `/api-spec`

**Skills:** agile-fundamentals, user-stories, bpmn-modeling, api-specification, doc-worker

**Роль:** Детализация требований, написание user stories, технические спецификации, API контракты

**MCP (3):** Notion, PDF Reader, Google Drive

---

### dex-devops

**Для:** DevOps инженеров

**Агенты:**
- `pipeline-expert` - CI/CD пайплайны
- `k8s-specialist` - Kubernetes
- `docker-builder` - Docker

**Команды:** `/deploy`, `/pipeline`, `/dockerfile`

**Skills:** gitlab-ci, docker-best-practices, kubernetes

**MCP:** GitLab

---

### dex-product-manager

**Для:** Продакт-менеджеров

**Агенты:**
- `business-requirements-analyst` - формализация бизнес-идей и требований
- `roadmap-planner` - стратегическое планирование roadmap
- `backlog-manager` - управление epic-level бэклогом
- `metrics-analyst` - анализ продуктовых метрик и KPI

**Команды:** `/create-epic`, `/release-notes`

**Skills:** agile-fundamentals, product-discovery, epic-planning, prioritization, doc-worker

**Роль:** Бизнес-требования, epic planning, стратегическая приоритизация, success metrics

**MCP:** Notion

---

### dex-python-ml-developer

**Для:** Python ML инженеров и Data Scientists

**Агенты:**
- `ml-experimenter` - EDA и feature engineering
- `model-trainer` - обучение моделей (PyTorch/TensorFlow/sklearn)
- `model-debugger` - отладка ML моделей
- `deployment-assistant` - деплой моделей (ONNX, TFLite, FastAPI)
- `data-pipeline-builder` - оптимизация data loading

**Команды:** `/train`, `/evaluate`, `/tune`, `/profile`, `/convert`, `/serve`

**Skills:** pytorch-patterns, tensorflow-patterns, classical-ml, nlp-transformers, computer-vision, ml-optimization

**MCP:** MLflow, Weights & Biases, HuggingFace, GitLab, Notion

---

## Иерархия компонентов

```
Claude Code (главный агент)
│
├── 📦 Plugins — контейнеры для распространения
│   └── Содержат: agents, commands, skills, hooks, MCP
│
├── 🤖 Subagents — специализированные агенты
│   └── .claude/agents/*.md
│
├── 🔌 MCP Servers — интеграции с внешними системами
│   └── .mcp.json
│
├── ⚡ Hooks — автоматические действия
│   └── hooks/hooks.json
│
├── 📝 Slash Commands — ручные команды
│   └── commands/*.md
│
└── 🧠 Skills — знания по контексту
    └── skills/name/SKILL.md
```

## Разделение ролей: Product Manager vs System Analyst

### Product Manager (Strategic Level)

**Фокус:** Business value, strategic goals, high-level planning

**Ответственность:**
- 📋 **Epics**: создание и управление epic-level требованиями
- 🗺️ **Roadmap**: квартальное/годовое планирование
- 📊 **Metrics**: business KPIs, success criteria, OKRs
- 🎯 **Prioritization**: RICE scoring, strategic приоритеты
- 💡 **Business Requirements**: формализация бизнес-идей

**НЕ делает:**
- ❌ Написание user stories (это SA)
- ❌ Acceptance criteria (это SA)
- ❌ Технические спецификации (это SA)

### System Analyst (Tactical Level)

**Фокус:** Technical specifications, detailed requirements, implementation details

**Ответственность:**
- 📝 **User Stories**: decompose epics в stories с INVEST criteria
- ✅ **Acceptance Criteria**: Given-When-Then scenarios
- 🔄 **BPMN**: процессы и workflows
- 🔌 **API Specs**: OpenAPI/Swagger контракты
- 📄 **Documentation**: техническая документация

**НЕ делает:**
- ❌ Roadmap planning (это PM)
- ❌ Business metrics analysis (это PM)
- ❌ Strategic prioritization (это PM)

### Collaboration Flow

```
PM создает Epic
    ↓
PM + SA: refinement session
    ↓
SA декомпозирует в User Stories
    ↓
PM reviews alignment с business value
    ↓
PM + SA приоритизируют stories
    ↓
Dev Team оценивает и реализует
```

## Структура плагина

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Manifest (обязательно)
├── agents/                  # Субагенты
│   └── agent-name.md
├── commands/                # Slash-команды
│   └── command-name.md
├── skills/                  # Skills
│   └── skill-name/
│       └── SKILL.md
├── hooks/                   # Hooks
│   └── hooks.json
└── prompts/
    └── system-prompt.md     # Системный промпт роли
```

**Примечание:** MCP конфиги вынесены в централизованный каталог `mcp/`. Плагины НЕ содержат `.mcp.json` файлов. Пользователи настраивают MCP серверы в своем `.mcp.json` согласно таблице "MCP серверы по плагинам" ниже.

## Конвенции

### Именование

- **Plugins**: `kebab-case` (dex-dotnet-developer)
- **Agents**: `kebab-case` (coding-assistant, bug-hunter)
- **Commands**: `kebab-case` (build, ef-migration)
- **Skills**: `kebab-case` папки с SKILL.md внутри

### Frontmatter агентов

```yaml
---
name: agent-name
description: Краткое описание (для триггеров)
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
permissionMode: default
skills: skill1, skill2
---
```

### Frontmatter skills

```yaml
---
name: skill-name
description: Описание когда активировать (ключевые слова)
allowed-tools: Read, Grep, Glob
---
```

## Технологический стек

### .NET Stack

- **.NET**: 8.0+
- **Async**: async/await + CancellationToken везде
- **DI**: Constructor injection
- **Паттерны**: Repository, Unit of Work, Result<T>
- **ORM**: Entity Framework Core
- **Тесты**: xUnit + Moq + Playwright
- **CI/CD**: GitLab CI
- **Контейнеры**: Docker, Kubernetes
- **Messaging**: RabbitMQ + MassTransit
- **Search**: Elasticsearch + NEST
- **Caching**: Redis + StackExchange.Redis
- **Logging**: Serilog + Seq

### Python ML Stack

- **Python**: 3.10+
- **Deep Learning**: PyTorch, TensorFlow/Keras
- **Classical ML**: scikit-learn, XGBoost, LightGBM
- **NLP**: HuggingFace Transformers, tokenizers
- **Computer Vision**: torchvision, albumentations, timm
- **MLOps**: MLflow, Weights & Biases, Optuna, Ray Tune
- **Deployment**: ONNX, TFLite, FastAPI, Docker
- **Code Quality**: black, isort, mypy, pytest

## Переменные окружения

Все токены через `${VAR_NAME}`:

### .NET Plugins
- `${GITLAB_TOKEN}` - GitLab API
- `${NOTION_TOKEN}` - Notion API
- `${GITHUB_TOKEN}` - GitHub API
- `${KAFKA_BROKERS}`, `${KAFKA_CLIENT_ID}`, `${KAFKA_SASL_*}` - Apache Kafka
- `${SEQ_SERVER_URL}`, `${SEQ_API_KEY}` - Seq logging server
- `${TEAMCITY_URL}`, `${TEAMCITY_TOKEN}`, `${MCP_MODE}` - TeamCity CI/CD
- `${GRAFANA_URL}`, `${GRAFANA_API_KEY}` - Grafana monitoring
- `${K8S_READONLY}` - Kubernetes read-only mode (true/false)
- **RabbitMQ:** Подключение через MCP tool `rabbitmq_broker_initialize_connection()`
- **Databases:** Конфигурируются в `tools.yaml` для genai-toolbox (см. `mcp/examples/toolbox-config.yaml`)

### Python ML Plugin
- `${MLFLOW_TRACKING_URI}` - MLflow tracking server URL
- `${WANDB_API_KEY}` - Weights & Biases API key
- `${HUGGINGFACE_TOKEN}` - HuggingFace API token
- `${GITLAB_TOKEN}` - GitLab API
- `${NOTION_TOKEN}` - Notion API

### System Analyst Plugin
- `${NOTION_TOKEN}` - Notion API
- `${GOOGLE_DRIVE_OAUTH_CREDENTIALS}` - путь к OAuth credentials JSON файлу (опционально)

## Известные особенности

### .NET
- ConfigureAwait(false) НЕ нужен в ASP.NET Core
- Для read-only запросов использовать `AsNoTracking()`
- RabbitMQ: Implement idempotency, use dead-letter queues
- Kafka: EnableIdempotence=true, manual offset commit, consumer groups
- Redis: Set TTL on all keys, use SCAN not KEYS
- Elasticsearch: Use aliases for zero-downtime reindexing
- Docker: Multi-stage builds, non-root user
- Kubernetes: Health probes, HPA, resource limits

### Python ML
- Type hints везде (Python 3.10+)
- Random seeds для reproducibility (`torch.manual_seed(42)`)
- MLflow tracking для всех экспериментов
- DataLoader с `num_workers > 0` и `pin_memory=True`
- Mixed precision (AMP) для speedup на GPU

### Общие
- Skills активируются автоматически по ключевым словам в description
- **ВАЖНО:** При добавлении нового компонента (agent, skill, command) в существующий плагин обязательно увеличивайте версию в `plugin.json`. Claude Code кэширует метаданные плагинов и без изменения версии не подтянет обновления

## MCP Server Configuration

Начиная с версии 4.0, MCP конфигурации вынесены из плагинов в централизованный каталог `mcp/`.

### Для пользователей

1. Плагины **НЕ содержат** `.mcp.json` файлы
2. Плагины **НЕ содержат** поле `mcpServers` в `plugin.json` (это было удалено, так как не соответствует официальной схеме Claude Code)
3. Посмотрите в таблице "MCP серверы по плагинам" ниже - какие серверы нужны плагину
4. Скопируйте нужные серверы из `mcp/mcp-template.json` в свой `.mcp.json`
5. Настройте переменные окружения согласно `run-claude/sample.env`

### MCP серверы по плагинам

| Плагин | Required | Optional |
|--------|----------|----------|
| dex-product-manager | notion | - |
| dex-system-analyst | pdf-reader | notion, google-drive |
| dex-dotnet-developer | gitlab, notion | genai-toolbox, rabbitmq, kafka, docker, seq, kubernetes, teamcity, grafana, openapi |
| dex-dotnet-architect | github, gitlab, notion | filesystem |
| dex-python-ml-developer | gitlab | notion, mlflow, wandb, huggingface |
| dex-quality-assurance | gitlab | filesystem |
| dex-devops | gitlab | - |

Подробная документация: `mcp/README.md`
