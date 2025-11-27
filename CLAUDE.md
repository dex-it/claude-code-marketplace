# Claude Code Marketplace

## О проекте

Маркетплейс AI-агентов для разработчиков. Каждая роль в команде получает специализированного ассистента с нужными инструментами и знаниями.

**Концепция:** Плагин = Роль в команде. Установил плагин → получил всё для своей роли.

## Структура проекта

```
claude-code-marketplace/
├── .claude-plugin/
│   └── marketplace.json              # Каталог всех плагинов
├── plugins/
│   ├── dex-dotnet-developer/         # 🧑‍💻 .NET Разработчик
│   ├── dex-dotnet-architect/         # 🏗️ Архитектор
│   ├── dex-quality-assurance/        # 🧪 QA инженер
│   ├── dex-system-analyst/           # 📋 Системный аналитик
│   ├── dex-devops/                   # ⚙️ DevOps инженер
│   ├── dex-product-manager/          # 📊 Продакт-менеджер
│   └── dex-python-ml-developer/      # 🤖 Python ML Разработчик
├── CLAUDE.md
├── README.md
└── LICENSE
```

## Плагины по ролям

### dex-dotnet-developer

**Для:** .NET разработчиков (Full-stack с инфраструктурой)

**Агенты (6):**
- `coding-assistant` - написание кода, SOLID, паттерны
- `bug-hunter` - поиск и исправление багов
- `code-reviewer` - code review, безопасность
- `test-writer` - генерация тестов xUnit/Moq
- `infrastructure-assistant` - PostgreSQL, RabbitMQ, Redis, ES, Docker
- `performance-analyst` - N+1, профилирование, memory leaks

**Команды (11):** `/build`, `/test`, `/debug`, `/refactor`, `/ef-migration`, `/rabbit-status`, `/es-query`, `/redis-cache`, `/docker-build`, `/logs`, `/k8s-status`

**Skills (12):** dotnet-patterns, ef-core, async-patterns, linq-optimization, api-development, testing-patterns, rabbitmq-patterns, elasticsearch-patterns, redis-patterns, docker-patterns, logging-patterns, k8s-patterns

**MCP (9):** GitLab, PostgreSQL (postgres-mcp), Notion, RabbitMQ, Elasticsearch, Redis, Docker, Seq, Kubernetes

**CLI Fallbacks:** psql, rabbitmqadmin, redis-cli, curl (ES), docker/docker-compose, kubectl/helm

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
- `requirements-analyst` - анализ требований
- `user-story-writer` - User Stories
- `process-modeler` - BPMN моделирование

**Команды:** `/write-story`, `/api-spec`

**Skills:** user-stories, bpmn-modeling, api-specification

**MCP:** Notion

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
- `roadmap-planner` - планирование roadmap
- `backlog-manager` - управление бэклогом
- `metrics-analyst` - анализ метрик

**Команды:** `/create-epic`, `/prioritize`, `/release-notes`

**Skills:** product-discovery, prioritization, agile-artifacts

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

## Структура плагина

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Manifest (обязательно)
├── .mcp.json                # MCP серверы (в корне!)
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
- `${NOTION_API_KEY}` - Notion API
- `${DATABASE_URL}` - PostgreSQL connection string
- `${GITHUB_TOKEN}` - GitHub API
- `${RABBITMQ_HOST}`, `${RABBITMQ_PORT}`, `${RABBITMQ_USER}`, `${RABBITMQ_PASSWORD}` - RabbitMQ
- `${ELASTICSEARCH_URL}`, `${ELASTICSEARCH_API_KEY}` - Elasticsearch
- `${REDIS_URL}` - Redis connection string
- `${SEQ_SERVER_URL}`, `${SEQ_API_KEY}` - Seq logging server
- `${K8S_READONLY}` - Kubernetes read-only mode (true/false)

### Python ML Plugin
- `${MLFLOW_TRACKING_URI}` - MLflow tracking server URL
- `${WANDB_API_KEY}` - Weights & Biases API key
- `${HUGGINGFACE_TOKEN}` - HuggingFace API token
- `${GITLAB_TOKEN}` - GitLab API
- `${NOTION_API_KEY}` - Notion API

## Известные особенности

### .NET
- ConfigureAwait(false) НЕ нужен в ASP.NET Core
- Для read-only запросов использовать `AsNoTracking()`
- RabbitMQ: Implement idempotency, use dead-letter queues
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
- .mcp.json должен быть в корне плагина, не в подпапке
- Skills активируются автоматически по ключевым словам в description
