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
│   │   agents/agent-name.md → фазы (Goal/Output/Exit criteria)
│   │   commands/command.md → slash-команды
│   │   Один агент = одна специализация.
│   │   Skills загружаются императивно через Skill tool.
│   │
│   └── Level 1: SKILL (база знаний)
│       skills/skill-name/SKILL.md
│       Автоматически активируется по контексту.
│
└── Level 1: UTILITY (инструмент)
    hooks, notifications, etc.
```

### Связи между уровнями

- **Bundle → Specialist/Skill**: перечисляет в `bundle.json` `includes[]`
- **Specialist → Skill**: загружает skills императивно через Skill tool в фазах
- **Skill**: самостоятельный плагин, активируется автоматически по ключевым словам

### Пример цепочки

```
dex-bundle-dotnet-developer (bundle.json)
├── includes: dex-dotnet-coder          ← specialist (загружает skills через Skill tool)
├── includes: dex-skill-dotnet-patterns ← skill (устанавливается отдельно)
├── includes: dex-skill-ef-core         ← skill
└── ...
```

## Гайдлайны: как писать Skills

Подробные правила см. в [SKILL_FRAMEWORK.md](docs/SKILL_FRAMEWORK.md) — принципы, формат, анти-паттерны, библиотека категорий, пример полного skill, валидатор.

**Краткая суть:** skill — это ловушки и anti-patterns, не документация API. Claude знает синтаксис и базовые концепции; skill нужен для неочевидного поведения, критических правил и trade-off'ов. Формат: «Плохо / Правильно / Почему», 3-5 строк на ловушку, 80-120 строк на skill.

## Гайдлайны: как писать Specialists (агенты)

Подробные правила см. в [AGENT_FRAMEWORK.md](docs/AGENT_FRAMEWORK.md) — фреймворк сборки агентов из фаз, правила композиции, gate'ы, библиотека типовых фаз, рецепты для 6 типов (Analyst/Diagnostician/Creator/Designer/Operator/Planner), валидатор.

**Краткая суть:** агент описывает workflow через фазы. Фаза — декларативный контракт (goal/output/exit criteria/gate), не процедура. Claude знает КАК делать — фаза задаёт ЧТО и КОГДА готово. Skills загружаются императивно через Skill tool в нужных фазах, не pre-loaded через frontmatter.

## Гайдлайны: как писать Commands (slash-команды)

Подробные правила см. в [COMMAND_FRAMEWORK.md](docs/COMMAND_FRAMEWORK.md) — принципы, формат, анти-паттерны, размер, когда команда вырастает в агент.

**Краткая суть:** команда = точечное действие по запросу пользователя (`/build`, `/test`, `/metrics`). Описывает Goal + Output format, не bash-скрипт. Claude знает как выполнить `dotnet build` — команда задаёт что должно быть достигнуто и в каком формате показать результат. Цель: 20-50 строк.

## Two-Pass Architecture (Analyst / Diagnostician)

Two-Pass Architecture применяется **только к Analyst и Diagnostician** — там где есть процедура сканирования по чек-листу. Остальные типы используют свои workflow.

**Pass 1: Direct Analysis** — агент анализирует код своими знаниями, без вызова Skill tool.

**Pass 2: Skill-Based Deep Scan** — агент **императивно загружает** skills через Skill tool и проходит по их чек-листам. Дедупликация с Pass 1 — только новые находки.

**Механизм загрузки skills:**
- Skills **НЕ** указываются в frontmatter через `skills:` (проектное решение маркетплейса — экономия контекста)
- В frontmatter добавляется `Skill` в поле `tools:` — это даёт агенту доступ к Skill tool для императивной загрузки в runtime
- В Pass 2 агент вызывает Skill tool с точным именем плагина в формате `dex-skill-<name>:<name>` (например, `dex-skill-ef-core:ef-core`)
- Загружаются только релевантные контексту skills, не все подряд

## Структура проекта

```
claude-code-marketplace/
├── .claude-plugin/
│   └── marketplace.json           # Каталог всех 111 плагинов
├── mcp/                           # Централизованный каталог MCP серверов
│   ├── README.md
│   └── mcp-template.json
├── plugins/
│   ├── skills/                    # Level 1: Knowledge bases (52 плагина)
│   │   ├── dex-skill-agile/
│   │   ├── dex-skill-dotnet-di/
│   │   ├── dex-skill-docker/
│   │   └── ...
│   ├── utilities/                 # Level 1: Tools (8 плагинов)
│   │   └── dex-telegram-notifier/
│   ├── specialists/               # Level 2: Agents (41 плагин)
│   │   ├── dotnet/               # .NET specialists (6)
│   │   ├── fullstack/            # Fullstack specialists (1)
│   │   ├── infrastructure/       # Infrastructure specialists (14)
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

## Level 1: Skills (52 плагина)

Skills - базы знаний, активируются автоматически по ключевым словам в контексте.

### .NET Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-dotnet-di | .NET DI: регистрация, lifetime, captive dependency, Service Locator |
| dex-skill-dotnet-solid | SOLID: SRP, OCP, LSP, ISP, DIP нарушения (универсальный) |
| dex-skill-dotnet-resources | .NET ресурсы: IDisposable, утечки памяти, socket exhaustion |
| dex-skill-dotnet-testability | Тестируемость: скрытые зависимости, детерминизм (универсальный) |
| dex-skill-dotnet-ef-core | EF Core: ловушки запросов, миграций, concurrency |
| dex-skill-dotnet-async-patterns | .NET async/await: блокировки, CancellationToken, параллелизм |
| dex-skill-dotnet-linq-optimization | LINQ и коллекции: материализация, фильтрация, HashSet vs List |
| dex-skill-dotnet-api-development | ASP.NET Core Web API: контроллеры, DTO, пагинация |
| dex-skill-api-documentation | OpenAPI/Swagger: ловушки spec, генерации клиентов |
| dex-skill-dotnet-testing-patterns | .NET unit-тестирование: xUnit, Moq, AAA, Theory |
| dex-skill-dotnet-logging | .NET structured logging: Serilog, ILogger, Seq |
| dex-skill-dotnet-csproj-hygiene | .csproj hygiene: TFM, Nullable, warnings-as-errors, PackageReference |
| dex-skill-dotnet-resilience | Resilience: Polly, retry, circuit breaker, timeout, bulkhead |

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
| dex-skill-observability | Observability: OpenTelemetry, prometheus, grafana, jaeger |

### Architecture Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-clean-architecture | Clean Architecture: ловушки слоёв, зависимостей, транзакций |
| dex-skill-ddd | DDD: aggregate, value object, domain events, bounded context |
| dex-skill-microservices | Microservices: saga, circuit breaker, gRPC, outbox pattern |

### Audit Skills
| Плагин | Описание |
|--------|----------|
| dex-skill-tech-audit | Технический аудит: идея → подход → компонентная база → код → вердикт |
| dex-skill-deep-audit | Глубокий аудит компонента: контракты, concurrency, ошибки, безопасность |

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

## Level 1: Utilities (8 плагинов)

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

### dex-mcp-inspector

MCP Inspector для тестирования и отладки MCP серверов.

**Функционал:**
- Запуск MCP Inspector веб-UI для любого настроенного сервера
- Автоопределение серверов из `.mcp.json` или `mcp-template.json`
- Тестирование tools, resources, prompts, просмотр истории запросов

**Команды:** `/mcp-inspect`

**Зависимости:** Node.js (npx)

### dex-gitlab-cli

GitLab CLI утилита: pipelines, merge requests, job logs через `glab`.

**Команды:** `/gl-pipelines`, `/gl-mrs`, `/gl-logs`

**Зависимости:** `glab` CLI

### dex-github-cli

GitHub CLI утилита: workflow runs, pull requests, Actions logs через `gh`.

**Команды:** `/gh-runs`, `/gh-prs`, `/gh-logs`

**Зависимости:** `gh` CLI

### dex-kubectl-cli

Kubernetes CLI утилита: pods, logs, deployments, events через `kubectl`.

**Команды:** `/kube-pods`, `/kube-logs`, `/kube-deploy`, `/kube-events`

**Зависимости:** `kubectl`

### dex-teamcity-cli

TeamCity CLI утилита: builds, agents, build logs через REST API.

**Команды:** `/tc-builds`, `/tc-agents`, `/tc-logs`

**Переменные:**
- `TEAMCITY_URL` - URL сервера (обязательно)
- `TEAMCITY_TOKEN` - API токен (обязательно)

### dex-jenkins-cli

Jenkins CLI утилита: jobs, builds, console output через REST API.

**Команды:** `/jk-jobs`, `/jk-builds`, `/jk-logs`

**Переменные:**
- `JENKINS_URL` - URL сервера (обязательно)
- `JENKINS_USER` - Имя пользователя (обязательно)
- `JENKINS_API_TOKEN` - API токен (обязательно)

## Level 2: Specialists (41 плагин)

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
| dex-dotnet-reviewer | code-reviewer | Reviewer-рецепт: domain priming, skill-scan, non-code audit, severity labels, /mr-collect + /mr-analyze |
| dex-dotnet-tester | test-writer | Unit тесты, xUnit, Moq |
| dex-ef-specialist | ef-specialist | EF Core: migrations, queries, DbContext |
| dex-dotnet-performance | performance-analyst | Profiling, N+1, memory, OpenTelemetry |

### Infrastructure Specialists (14)

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
| dex-cicd-github | GitHub Actions: workflows, matrix builds, deployments |
| dex-cicd-teamcity | TeamCity: build configurations, pipelines |
| dex-cicd-jenkins | Jenkins: Jenkinsfile, declarative pipelines, shared libraries |
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

## Level 3: Bundles (10 плагинов)

Bundles - мета-плагины для удобной установки наборов. Содержат список компонентов для установки.

| Bundle | Включает |
|--------|----------|
| dex-bundle-dotnet-developer | 6 .NET specialists + 6 .NET skills |
| dex-bundle-dotnet-fullstack | dotnet-developer + 11 infrastructure specialists + skills |
| dex-bundle-devops | 8 infrastructure specialists + 7 skills + 5 CLI utilities |
| dex-bundle-product-manager | 4 product specialists + PM skills |
| dex-bundle-system-analyst | 4 SA specialists + SA skills |
| dex-bundle-architect | 4 architecture specialists + architecture skills |
| dex-bundle-qa-engineer | 3 QA specialists + QA skills |
| dex-bundle-ml-engineer | 5 ML specialists + ML skills |
| dex-bundle-ts-fullstack | 1 TS fullstack specialist + 6 skills (TS, Node.js, React, OWASP, Docker, Git) |
| dex-bundle-infrastructure | 14 infrastructure specialists + all infra skills + 5 CLI utilities |

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
description: Краткое описание. Триггеры — keyword1, keyword2, ...
tools: Read, Write, Edit, Bash, Grep, Glob, Skill
---
```
> **Важно:** `skills:` в frontmatter запрещён — skills загружаются императивно через Skill tool в фазах. `allowed-tools:` не поддерживается Claude Code.

### Frontmatter skills
```yaml
---
name: skill-name
description: Ключевые слова для автоматической активации
---
```
> **Важно:** `keywords` не поддерживается в skills — ключевые слова включать в `description`. Валидные поля: name, description, disable-model-invocation, user-invocable, argument-hint, allowed-tools, model, effort, context, agent, hooks, paths, shell.

## Валидация

Каждый новый или изменённый агент, skill и команда **обязательно** проверяются валидатором перед коммитом. Все проверки строгие (errors), мягкого режима нет.

```bash
npm run validate              # все: agents + skills + commands
npm run validate:agents       # только агенты
npm run validate:skills       # только skills
npm run validate:commands     # только команды
```

CI автоматически блокирует PR с ошибками валидации.

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

## Чек-лист при изменении плагинов

Уроки, накопленные в работе над маркетплейсом. Проходить по списку **до коммита** любых правок в `plugins/` или `docs/`.

### Принципы содержания

- **Skill = обобщённое правило, не конкретика одного проекта.** Читая критику конкретного MR, извлекать универсальный принцип. Имена Entity / классов / доменных терминов из реального проекта в ловушке — сигнал, что правило не обобщено. Принцип проверки: «убери имена проекта — правило всё ещё читается и применяется?». См. анти-паттерн №10 в `SKILL_FRAMEWORK.md`.
- **Skill — ловушки и anti-patterns, не документация API.** Формат «Плохо / Правильно / Почему», 3-5 строк на ловушку. Claude знает синтаксис — skill нужен только для неочевидного поведения и граблей.
- **Агент описывает workflow через фазы, не процедуры.** Goal / Output / Exit criteria / Gate. Ни «сделай grep», ни примеров кода. Mandatory-фазы обязательно с обоснованием «зачем».

### Версионирование при изменениях (semver)

| Тип изменения | Bump | Пример |
| ------------- | ---- | ------ |
| Новый плагин | `1.0.0` | Создан новый skill / специалист |
| Rename плагина | major (`2.0.0`) | Переименование имени в frontmatter / директории |
| Breaking change в workflow / API агента | major | Новый рецепт, изменение output format |
| **Добавление новых ловушек в skill** | minor (`+0.1.0`) | Обогащение существующего skill обратно-совместимо |
| Новая категория ловушек | minor | Добавлен раздел, keywords расширены |
| Dedup с другим skill | minor | Перенос общих ловушек в базовый skill |
| Fix description / keywords / опечатка | patch (`+0.0.1`) | Уточнение без содержательных правок |

**Версии обновляются в двух местах одновременно:** `.claude-plugin/plugin.json` **и** `.claude-plugin/marketplace.json`. Несогласованность — частая ошибка.

### Обязательные синхронизации

- **Создал новый skill** → добавить запись в `.claude-plugin/marketplace.json` (иначе плагин не виден каталогу)
- **Создал новый skill, который использует агент из bundle** → добавить в `bundle.json` соответствующего bundle (иначе пользователи bundle не получат skill, агент будет ссылаться в пустоту)
- **Создал новый skill, на который ссылается агент в фазе Skill-Based Scan** → проверить, что точное имя `{plugin}:{skill}` совпадает с фактической директорией
- **Поменял description / keywords skill** → проверить длину description (≤250 символов), иначе валидатор `npm run validate:skills` упадёт
- **Поменял агента** → mandatory-фазы требуют явного обоснования «почему mandatory», иначе валидатор упадёт

### Механизмы композиции в Claude Code

Проверено по официальной документации (code.claude.com/docs/en/skills + tools-reference.md):

| Путь | Работает | Механизм |
| ---- | -------- | -------- |
| command → skill | ✓ | `Skill` в `allowed-tools` команды, вызов в теле |
| agent → skill | ✓ | `Skill` tool в frontmatter агента, императивный вызов в фазе (указывается имя `{plugin}:{skill}`) |
| agent → agent | ✓ | `Agent` tool — спавн субагента. Глубина рекурсии не задокументирована |
| skill → skill | ✗ | API нет. Ссылка `см. dex-skill-X` в теле SKILL.md — только сноска для человека |
| skill → agent | не задокументировано | считать, что нет |
| command → agent | не задокументировано | считать, что нет |

**Практические правила:**

- **Skill не загружает другой skill.** Если в теле SKILL.md встречается `dex-skill-X` — только как справочная сноска (`> см. dex-skill-X`). Формулировка «загружает / активирует / подключает» другой skill — ложь, переписать.
- **Дублирование ловушек между skills — зло.** При пересечении тем оставить содержимое в одном skill, из другого — сноска.
- **Композиция skills — через агента.** Один агент в своей фазе вызывает несколько Skill tool с точными именами `{plugin}:{skill}`.
- **Связь между специалистами в bundle** — это установка вместе, не runtime-вызов.

### Проверка обобщённости ловушки перед коммитом

- Нет ли в тексте имён конкретного проекта, где была впервые замечена проблема? (`UpCore`, `MergeRequest`, `EyeLineData`, `ArchValue` и т.п.)
- Нет ли привязки к IDE-specific-конвенциям (`.junie/`, `.cursorrules`, и т.д.)? Вместо перечисления — обобщённое «любые документы проекта с конвенциями» + примеры.
- Если скилл .NET-specific — имена API .NET допустимы, имена из конкретного стартапа — нет.

### Обязательные фазы для агентов-ревьюеров (рецепт Reviewer)

Если создаёшь / правишь ревью-агента — workflow по рецепту Reviewer в `AGENT_FRAMEWORK.md`:

1. **Domain Priming** — mandatory, словарь проекта до анализа
2. **Direct Analysis** — mandatory
3. **Skill-Based Deep Scan** — mandatory, условная загрузка skills
4. **Non-Code Artifacts Audit** — mandatory, `.csproj` / конфиги / CI
5. **Content-Level Pass** — «важно оператору в 3 ночи или только разработчику?»
6. **Cross-Linking** — mandatory, группы root cause → symptoms
7. **Severity Calibration** — mandatory, под project stage
8. **Tech Debt Classification** — mandatory, дефолт «подсвечивать»
9. **Systemic vs Specific Triage** — optional
10. **Output Labeling** — mandatory, цветная шкала 🟢🟡🟠🔴🟣
11. **Report** — mandatory

**Дефолт подсвечивания**: если в проектной документации / коде / описании MR нет маркеров accepted tech debt (TODO+Jira, ADR, `[Obsolete]`, пометка в CLAUDE.md) — находка подсвечивается, не молча принимается.

### Перед коммитом

- `npm run validate` — прогнать все валидаторы (agent + skill + command), 0 ошибок
- Проверить размер skill: 80-120 строк цель, до 150 допустимо
- Проверить длину `description`: ≤ 250 символов (иначе keywords обрежутся)
- Проверить что все Skill-ссылки в агентах указывают на существующие плагины

## Миграция с v4.0

### Было (v4.0)
8 монолитных плагинов с дублированием:
- dex-dotnet-developer (8 агентов, 17 команд, 17 skills)
- dex-dotnet-architect, dex-devops, dex-product-manager...

### Стало (v5.0)
111 атомарных плагинов без дублирования:
- 52 skills (Level 1)
- 8 utilities (Level 1)
- 41 specialist (Level 2)
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
