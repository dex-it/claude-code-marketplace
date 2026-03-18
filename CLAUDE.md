# Claude Code Marketplace v5.0

## О проекте

Маркетплейс атомарных AI-плагинов для разработчиков. Каждый плагин имеет узкую специализацию: один плагин = одна функция.

**Концепция:** Атомарные плагины без дублирования. Собирай свой набор из нужных компонентов.

## Архитектура: 3 уровня

```
Level 3: BUNDLE (набор для роли)
│   bundle.json → includes: ["dex-specialist-x", "dex-skill-y"]
│   Не содержит кода. Просто список компонентов для установки.
│
├── Level 2: SPECIALIST (агент)
│   │   agents/agent-name.md → skills: skill-a, skill-b
│   │   commands/command.md → slash-команды
│   │   Один агент = одна специализация.
│   │
│   └── Level 1: SKILL (база знаний)
│       skills/skill-name/SKILL.md
│       Автоматически активируется по контексту.
│       Подключается к specialist через frontmatter `skills:`.
│
└── Level 1: UTILITY (инструмент)
    hooks, notifications, etc.
```

### Связи между уровнями

- **Bundle → Specialist/Skill**: перечисляет в `bundle.json` `includes[]`
- **Specialist → Skill**: указывает в frontmatter `skills: skill-a, skill-b`
- **Skill**: самостоятельный плагин, активируется автоматически по ключевым словам

### Пример цепочки

```
dex-bundle-dotnet-developer (bundle.json)
├── includes: dex-dotnet-coder          ← specialist
│   └── skills: dotnet-patterns,        ← привязанные skills
│              ef-core,
│              api-development,
│              async-patterns
├── includes: dex-skill-dotnet-patterns ← skill (устанавливается отдельно)
└── ...
```

## Гайдлайны: как писать Skills

### Принцип: Skills — это НЕ документация

Skill — это **ловушки и грабли**, а не туториал. Claude и так знает API, синтаксис и паттерны из training data. Skill нужен чтобы **предотвратить типичные ошибки**.

### Что писать

- **Anti-patterns**: конкретные ошибки с объяснением почему это плохо
- **Ловушки**: неочевидное поведение, которое ведёт к багам
- **Критические правила**: то, что нельзя нарушать (безопасность, производительность)
- **Trade-offs**: когда выбор неочевиден и зависит от контекста

### Что НЕ писать

- Документацию API (Claude знает)
- Примеры "как создать X" (Claude умеет)
- Полные code samples с boilerplate
- Объяснения базовых концепций
- Всё, что можно найти в official docs

### Формат

```markdown
## Категория

### Ловушка: название
Неправильно: `код`
Правильно: `код`
Почему: объяснение в 1-2 предложения
```

### Размер

- **Цель**: 80-120 строк (максимум ~150)
- Каждая ловушка: 3-5 строк (код + объяснение)
- 10-15 ловушек на skill — достаточно

### Пример хорошего skill (фрагмент)

```markdown
## Query Traps

### N+1 в цикле
Неправильно: `foreach → context.Orders.Where(o => o.UserId == id)`
Правильно: `.Include(u => u.Orders)` или projection `.Select()`
Почему: N+1 queries, каждая итерация = отдельный SQL запрос

### AsNoTracking забыт для read-only
Неправильно: `context.Users.ToList()` для отображения
Правильно: `context.Users.AsNoTracking().ToList()`
Почему: Change Tracker держит все entities в памяти, leak на больших выборках
```

### Пример плохого skill (НЕ делать так)

```markdown
## Как создать DbContext                    ← это документация
public class AppDbContext : DbContext       ← Claude знает
{
    public DbSet<User> Users { get; set; }  ← boilerplate
    ...50 строк примера...                  ← пустая трата токенов
}
```

### Ревью skills по официальной документации

Каждый skill ОБЯЗАТЕЛЬНО проверяется на соответствие официальной документации Claude Code:
- Формат: https://code.claude.com/docs/en/skills.md
- Best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

При ревью проверять:
1. **Frontmatter** — корректные поля (name, description, disable-model-invocation, user-invokable, argument-hint, compatibility, license, metadata). **НЕ** использовать `allowed-tools` — не поддерживается
2. **description** — содержит ключевые слова для семантической активации (см. правила ниже)
3. **Содержание** — ловушки/anti-patterns, а не документация (проектное правило)
4. **Размер** — до 500 строк (официальный лимит), проект рекомендует 80-150

### Правила формирования description для Skills

Description — это **единственный механизм** автоматической активации skill. Claude Code семантически матчит контекст разговора с description. Плохой description = skill не активируется.

**Формат:**
```
description: Краткое описание назначения. Активируется при keyword1, keyword2, keyword3, ...
```

**Правила:**
1. **Первая часть** — что skill делает (1 предложение)
2. **Вторая часть** — после "Активируется при" перечислить все релевантные ключевые слова через запятую
3. **Стек-агностичность** — НЕ привязывать к одному стеку, если skill применим шире (например, logging — это не только Serilog)
4. **Покрытие синонимов** — включать варианты написания: `node.js, nodejs, node api`
5. **Покрытие инструментов** — включать конкретные библиотеки/CLI: `jest, vitest, playwright` (не только абстрактные "тесты")
6. **Покрытие паттернов** — включать паттерны использования: `Promise.all, event loop, race condition`
7. **Без "при упоминании"** — писать просто "Активируется при", без лишних слов
8. **15-25 ключевых слов** — достаточно для хорошего покрытия, больше — шум

## Структура проекта

```
claude-code-marketplace/
├── .claude-plugin/
│   └── marketplace.json           # Каталог всех 94 плагинов
├── mcp/                           # Централизованный каталог MCP серверов
│   ├── README.md
│   └── mcp-template.json
├── plugins/
│   ├── skills/                    # Level 1: Knowledge bases (43 плагина)
│   │   ├── dex-skill-agile/
│   │   ├── dex-skill-dotnet-patterns/
│   │   ├── dex-skill-docker/
│   │   └── ...
│   ├── utilities/                 # Level 1: Tools (2 плагина)
│   │   └── dex-telegram-notifier/
│   ├── specialists/               # Level 2: Agents (39 плагинов)
│   │   ├── dotnet/               # .NET specialists (6)
│   │   ├── fullstack/            # Fullstack specialists (1)
│   │   ├── infrastructure/       # Infrastructure specialists (12)
│   │   ├── architecture/         # Architecture specialists (4)
│   │   ├── product/              # Product & SA specialists (8)
│   │   ├── qa/                   # QA specialists (3)
│   │   └── ml/                   # ML specialists (5)
│   └── bundles/                   # Level 3: Meta-plugins (10 плагинов)
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

## Level 1: Skills (43 плагина)

Skills - базы знаний, активируются автоматически по ключевым словам в контексте.

### .NET Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-dotnet-patterns | Ловушки DI, SOLID нарушения, антипаттерны проектирования |
| dex-skill-ef-core | EF Core: ловушки запросов, миграций, concurrency |
| dex-skill-async-patterns | Async/await: блокировки, параллелизм, Promise.all, event loop |
| dex-skill-linq-optimization | LINQ и коллекции: материализация, фильтрация, HashSet vs List |
| dex-skill-api-development | ASP.NET Core Web API: ловушки контроллеров, DTO, пагинации |
| dex-skill-api-documentation | OpenAPI/Swagger: ловушки spec, генерации клиентов |
| dex-skill-testing-patterns | Тестирование: jest, vitest, xUnit, Moq, playwright, AAA |

### Frontend & TypeScript Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-react | React: hooks, state, Next.js, Remix, SSR, TanStack |
| dex-skill-typescript-patterns | TypeScript: type guard, discriminated union, strict mode |
| dex-skill-nodejs-api | Node.js API: Express/Fastify/Hono/NestJS, middleware, Zod |

### Security Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-owasp-security | OWASP Top 10: injection, XSS, IDOR, CSRF, JWT, SSRF |

### Workflow Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-git-workflow | Git: gitflow, trunk-based, conventional commits, code review |

### Infrastructure Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-rabbitmq | RabbitMQ: amqp, MassTransit, exchange, dead-letter, prefetch |
| dex-skill-kafka | Kafka: kafkajs, confluent, consumer group, exactly-once |
| dex-skill-elasticsearch | Elasticsearch: query DSL, ELK stack, Lucene, kibana |
| dex-skill-redis | Redis: ioredis, bullmq, distributed cache, TTL, ZADD |
| dex-skill-mongodb | MongoDB: mongoose, aggregation pipeline, atlas, NoSQL |
| dex-skill-docker | Docker: multi-stage, compose, distroless, podman |
| dex-skill-kubernetes | Kubernetes: kubectl, HPA, kustomize, liveness/readiness |
| dex-skill-gitlab-ci | GitLab CI/CD: runner, pipelines, DAST, SAST |
| dex-skill-teamcity | TeamCity: Kotlin DSL, build chains, snapshot dependency |
| dex-skill-logging | Structured logging: serilog, winston, pino, fluentd |
| dex-skill-observability | Observability: OpenTelemetry, prometheus, grafana, jaeger |

### Architecture Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-clean-architecture | Clean Architecture: ловушки слоёв, зависимостей, транзакций |
| dex-skill-ddd | DDD: aggregate, value object, domain events, bounded context |
| dex-skill-microservices | Microservices: saga, circuit breaker, gRPC, outbox pattern |
| dex-skill-system-design | System Design: NFR, capacity planning, CAP theorem, trade-offs |

### Product & Analysis Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-agile | Agile: sprint, INVEST, DoR/DoD, velocity, story points |
| dex-skill-user-stories | User stories: INVEST, acceptance criteria, Given-When-Then |
| dex-skill-bpmn | BPMN: gateway (XOR/AND/OR), sequence/message flow, pools |
| dex-skill-doc-standards | Documentation: BRD, PRD, ADR, single source of truth |
| dex-skill-api-specification | API design: ProblemDetails, pagination, versioning, idempotency |
| dex-skill-epic-planning | Epic planning: sizing, anti-metrics, progressive elaboration |
| dex-skill-product-discovery | Product discovery: JTBD, hypothesis, MVP, Mom test |
| dex-skill-prioritization | Prioritization: RICE, ICE, MoSCoW, Kano model |

### QA Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-test-design | Test design: BVA, EP, decision table, state transition |
| dex-skill-api-testing | API testing: Testcontainers, status codes, ProblemDetails |

### ML Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-pytorch | PyTorch: training loop, DataLoader, DDP, mixed precision |
| dex-skill-tensorflow | TensorFlow/Keras: tf.data, callbacks, tf.function, SavedModel |
| dex-skill-classical-ml | Classical ML: data leakage, cross-validation, SMOTE, XGBoost |
| dex-skill-nlp-transformers | NLP: tokenization, fine-tuning, LoRA/QLoRA, NER |
| dex-skill-computer-vision | Computer Vision: augmentation, detection, segmentation, NMS |
| dex-skill-ml-optimization | ML optimization: Optuna, gradient accumulation, torch.compile |

## Level 1: Utilities (2 плагина)

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

### dex-discord-notifier

Discord уведомления о событиях Claude Code.

**Функционал:**
- Уведомления при завершении работы Claude (Stop)
- Уведомления при ожидании ответа (Notification)
- Уведомления при завершении субагентов (SubagentStop)
- Информация о TODO, последнем сообщении, инструментах

**Переменные:**
- `DISCORD_WEBHOOK_URL` - URL вебхука Discord (обязательно)

## Level 2: Specialists (39 плагинов)

Specialists - агенты с узкой специализацией. Один агент = один плагин.

### Fullstack Specialists (1)

| Плагин | Агент | Описание |
|--------|-------|----------|
| dex-ts-fullstack-coder | ts-fullstack-assistant | TypeScript fullstack: Node.js/Bun + React |

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
| dex-architect | System design, Clean Architecture, DDD, microservices, NFR analysis, trade-offs |
| dex-adr-writer | Architecture Decision Records, MADR format, decision drivers, trade-offs |
| dex-diagram-creator | C4, sequence, ER, state diagrams, Mermaid, PlantUML, Structurizr DSL |
| dex-api-designer | REST, GraphQL, gRPC, AsyncAPI, OpenAPI, contract-first, versioning |

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

## Level 3: Bundles (10 плагинов)

Bundles - мета-плагины для удобной установки наборов. Содержат список компонентов для установки.

| Bundle | Включает |
|--------|----------|
| dex-bundle-dotnet-developer | 6 .NET specialists + 6 .NET skills |
| dex-bundle-dotnet-fullstack | dotnet-developer + 11 infrastructure specialists + skills |
| dex-bundle-devops | 6 infrastructure specialists + DevOps skills |
| dex-bundle-product-manager | 4 product specialists + PM skills |
| dex-bundle-system-analyst | 4 SA specialists + SA skills |
| dex-bundle-architect | 4 architecture specialists + 11 skills (architecture, security, observability, system design) |
| dex-bundle-qa-engineer | 3 QA specialists + QA skills |
| dex-bundle-ml-engineer | 5 ML specialists + ML skills |
| dex-bundle-ts-fullstack | 1 TS fullstack specialist + 6 skills (TS, Node.js, React, OWASP, Docker, Git) |
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
---
```

### Frontmatter skills
```yaml
---
name: skill-name
description: Ключевые слова для автоматической активации
---
```
> **Важно:** `allowed-tools` не поддерживается в skills. Валидные поля: name, description, disable-model-invocation, user-invokable, argument-hint, compatibility, license, metadata.

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
94 атомарных плагина без дублирования:
- 43 skills (Level 1)
- 2 utilities (Level 1)
- 39 specialists (Level 2)
- 10 bundles (Level 3)

### Устраненное дублирование
- `agile-fundamentals` - было в PM и SA, теперь `dex-skill-agile`
- `doc-worker` - было в PM и SA, теперь `dex-skill-doc-standards`
- `docker-patterns` + `docker-best-practices` - теперь `dex-skill-docker`
- `k8s-patterns` + `kubernetes` - теперь `dex-skill-kubernetes`

### Как мигрировать
1. Удалите старые плагины
2. Установите нужный bundle или отдельные specialists/skills
3. Bundle содержит список компонентов в `bundle.json`
