# Claude Code Marketplace

> Маркетплейс атомарных AI-плагинов для разработчиков. Один плагин = одна функция.

## О проекте

Claude Code Marketplace - набор специализированных плагинов для Claude Code, организованных в 3 уровня:

```
Level 3: BUNDLES     - наборы для быстрой установки по ролям
Level 2: SPECIALISTS - агенты с узкой специализацией
Level 1: SKILLS      - базы знаний (автоматическая активация)
         UTILITIES   - инструменты (hooks, notifications, CLI)

Поверх уровней: AI-SDLC - движок `dex-sdlc:engine`, команды зон и треки,
которые ведут цель через специалистов и skills от идеи до приёмки.
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

Предварительно маркетплейс должен быть добавлен внутри Claude Code: `/plugin marketplace add dex-it/claude-code-marketplace`.
Дальше плагины ставятся по формату `name@dex-claude-marketplace`:

```bash
# Установить specialist
claude plugins install dex-dotnet-coder@dex-claude-marketplace

# Установить skill
claude plugins install dex-skill-dotnet-ef-core@dex-claude-marketplace

# Установить utility
claude plugins install dex-telegram-notifier@dex-claude-marketplace
```

### Удаление

```bash
# Удалить бандл
./install-bundle/uninstall-bundle.sh dotnet-developer

# Удалить отдельный плагин
claude plugins uninstall dex-dotnet-coder
```

## Бандлы (Level 3)

Мета-плагины для установки наборов. Не содержат кода - только список компонентов.

| Bundle | Описание |
|--------|----------|
| `dotnet-developer` | .NET разработчик |
| `dotnet-fullstack` | .NET + инфраструктура |
| `ts-fullstack` | TypeScript fullstack (Node.js/Bun + React) |
| `devops` | DevOps инженер |
| `product-manager` | Product Manager |
| `system-analyst` | Системный аналитик |
| `architect` | Архитектор |
| `qa-engineer` | QA инженер |
| `ml-engineer` | ML инженер |
| `infrastructure` | Вся инфраструктура |
| `cli-tools` | CLI-утилиты для диагностики (gh, glab, kubectl, jenkins, teamcity, psql, redis-cli, kaf, rabbitmqadmin, aws-s3, playwright) |
| `code-review` | Цикл работы с кодом: ревью MR/PR, ре-ревью дельты, план правок, реализация фичи, pre-push саморевью (языко-агностично) |
| `bug-lifecycle` | Жизненный цикл бага: поиск, оформление, RCA на стенде, фикс на источнике (языко-агностично) |
| `runtime-diagnostics` | Runtime-диагностика .NET и native-границы: hang, crash, leak, дампы, netcoredbg |
| `sdlc` | Полный цикл SDLC языко-агностично: движок автономного доведения задачи, требования, дизайн, реализация, тесты, ревью, стенд, баги, документирование. Стек добирается профильным бандлом |
| `market-editor` | Редактор маркетплейса: ревью артефакта каталога по осям фреймворка, сверка фактов, оптимизация под LLM, извлечение уроков из чужих MR. Ставится автору каталога, не пользователю |

Подробнее: [install-bundle/README.md](./install-bundle/README.md)

## Specialists (Level 2)

Агенты с узкой специализацией. Один плагин - один агент, кроме `dex-code-discovery` (оркестратор плюс ревьюер). Разбивка на секции повторяет каталоги на диске: секция = `plugins/specialists/<категория>/`.

### Architecture (`plugins/specialists/architecture/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-adr-writer | adr-writer | `/adr` | Architecture Decision Records |
| dex-api-designer | api-designer | `/api-docs` | REST API design, OpenAPI |
| dex-architect-dotnet | architect-dotnet | - | Дизайн-решение под .NET: reference match, альтернативы с ASP.NET Core / EF Core / MassTransit, CAP-trade-off |
| dex-architect | architect | `/review-arch` | System design, patterns, trade-offs |
| dex-code-discovery | discover-orchestrator, discover-reviewer | - | Обзорное ревью существующего кода вширь: инвентаризация по топикам, severity под масштаб, запись в `docs/discover/` |
| dex-design-reviewer | design-reviewer | `/review-design` | Приёмка чужого дизайн-документа - спека, ADR, диаграммы до кода |
| dex-diagram-creator | diagram-creator | - | C4, sequence diagrams, Mermaid |

### Delivery (`plugins/specialists/delivery/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-bug-fixer | bug-fixer | - | Пакетная ремедиация багов после мерджа: триаж, подтверждение причины, фикс на источнике, follow-up MR |
| dex-conflict-resolver | conflict-resolver | `/resolve-conflicts` | Подтянуть базу в фича-ветку и развести конфликты merge/rebase без тихой потери стороны |
| dex-debugger | debugger | - | Языко-агностичный root-cause debugger: воспроизведение, изоляция, red-green тест, фальсификация гипотез |
| dex-incident-investigator | incident-investigator | `/investigate` (плагин `dex-sdlc-ops`) | Расследование инцидента на общем стенде, RCA и фикс на источнике, read-only по умолчанию |
| dex-review-planner | review-planner | `/review-plan` (плагин `dex-sdlc-review`) | План правок по ревью без редактирования кода |
| dex-security-reviewer | security-reviewer | `/security-scan` | Глубокий анализ безопасности: threat model, attack paths по OWASP, цепочки эксплойтов, severity |

### .NET (`plugins/specialists/dotnet/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-dotnet-coder | dotnet-coder | `/build`, `/refactor` | Написание кода, SOLID, паттерны |
| dex-dotnet-performance | dotnet-performance-analyst | `/health-check`, `/metrics` | Profiling, N+1, memory |
| dex-dotnet-quality-auditor | dotnet-quality-auditor | `/dotnet-quality-audit` | Аудит гигиены качества .NET: анализаторы, warning-профиль, NuGet audit, NSDepCop, CI-gates |
| dex-dotnet-runtime-diagnostician | dotnet-runtime-diagnostician | - | Runtime-диагностика .NET и native-границы: hang, crash, leak, дампы, netcoredbg |
| dex-dotnet-tester | dotnet-test-writer | - | Unit тесты, xUnit, Moq |
| dex-ef-specialist | dotnet-ef-specialist | `/ef-migration` | EF Core: migrations, queries, DbContext |

### Fullstack (`plugins/specialists/fullstack/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-ts-fullstack-coder | ts-fullstack-assistant | - | TypeScript fullstack: Node.js/Bun + React |
| dex-ts-tester | ts-test-writer | - | Тесты TypeScript/JavaScript: Vitest/Jest, моки, fake timers, изоляция |

### Infrastructure (`plugins/specialists/infrastructure/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-cicd-github | github-actions-specialist | `/workflow` | GitHub Actions: workflows, matrix builds |
| dex-cicd-gitlab | gitlab-ci-specialist | - | GitLab CI/CD: pipelines, deployment |
| dex-cicd-jenkins | jenkins-specialist | `/jenkinsfile` | Jenkins: Jenkinsfile, shared libraries |
| dex-cicd-teamcity | teamcity-specialist | `/teamcity-status` | TeamCity: build configurations |
| dex-docker-specialist | docker-specialist | `/docker-build` | Docker: images, containers, compose |
| dex-elasticsearch-specialist | elasticsearch-specialist | `/es-query` | Elasticsearch: indexing, searching |
| dex-kafka-specialist | kafka-specialist | `/kafka-status` | Kafka: topics, consumers, partitions |
| dex-kubernetes-specialist | kubernetes-specialist | `/k8s-status` | Kubernetes: deployments, services, HPA |
| dex-logging-seq | seq-logging-specialist | `/logs` | Seq: log analysis, dashboards |
| dex-mongodb-specialist | mongodb-specialist | `/mongo-query` | MongoDB: queries, aggregation pipeline |
| dex-monitoring-grafana | grafana-specialist | `/metrics` | Grafana: dashboards, alerts, metrics |
| dex-postgresql-specialist | postgresql-specialist | - | PostgreSQL: queries, indexes, optimization |
| dex-rabbitmq-specialist | rabbitmq-specialist | `/rabbit-status` | RabbitMQ: queues, exchanges, MassTransit |
| dex-redis-specialist | redis-specialist | `/redis-cache` | Redis: caching, pub/sub |

### ML (`plugins/specialists/ml/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-data-pipeline | data-pipeline-builder | - | Data loading, preprocessing |
| dex-ml-deployer | deployment-assistant | `/convert`, `/serve` | ONNX, TFLite, FastAPI |
| dex-ml-experimenter | ml-experimenter | - | EDA, feature engineering |
| dex-model-debugger | model-debugger | `/evaluate`, `/profile` | Debugging ML models |
| dex-model-trainer | model-trainer | `/train`, `/tune` | PyTorch, TensorFlow, sklearn |

### Product (`plugins/specialists/product/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-backlog-manager | backlog-manager | - | Epic backlog, prioritization |
| dex-bdd-author | bdd-author | `/bdd` | Исполняемые примеры: карта примеров, `.feature` на Gherkin с трассировкой на `FR` |
| dex-business-analyst | business-requirements-analyst | - | Бизнес-требования: BRD с `BR-NNN` и MOE |
| dex-doc-writer | doc-writer | - | Technical specs, API docs |
| dex-domain-analyst | domain-analyst | - | Словарь продукта и конституция: `INV-NNN`, `NFR-P-NNN` с основанием и методом проверки |
| dex-pm-metrics-analyst | metrics-analyst | - | KPIs, OKRs, metrics |
| dex-process-modeler | process-modeler | - | BPMN, workflows |
| dex-requirements-analyst | requirements-analyst | - | Требования системного уровня: `FR`/`NFR` из `BR`, пробелы, конфликты |
| dex-roadmap-planner | roadmap-planner | - | Strategic planning |
| dex-use-case-writer | use-case-writer | `/use-cases` | Сценарии по Cockburn: основной ход, расширения с терминалом, минимальные гарантии |
| dex-usecase-analyst | usecase-analyst | - | Сценарии `UC` из бизнес-требований: актор, основной ход, расширения |
| dex-user-story-analyst | user-story-analyst | - | User stories, acceptance criteria |

Зона требований целиком (идея -> BRD -> `UC` -> `FR`/`NFR` -> stories, гейты с апрувом оператора) идёт через `/feature` (плагин `dex-sdlc-requirements`), не отдельным агентом.

### QA (`plugins/specialists/qa/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-bug-finder | bug-finder | - | Активный поиск багов: чартеры, адверсариальная охота, воспроизведение, handoff |
| dex-bug-reporter | bug-reporter | - | Bug reports, reproduction steps, RCA handoff |
| dex-test-analyst | test-analyst | - | Test design, coverage analysis |
| dex-test-automator | test-automator | - | Selenium, Playwright, API testing |

### Review (`plugins/specialists/review/`)

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-implementer-reader | implementer-reader | - | Проба готовности набора требований к разработке |
| dex-mr-check-reviewer | mr-check-reviewer | второй раунд `/mr-review`, не своя команда | Ре-ревью дельты с прошлого раунда (range-diff) |
| dex-mr-reviewer | mr-reviewer | `/mr-review` (плагин `dex-sdlc-review`) | Первичное ревью чужого MR/PR, инлайн-треды через gh/glab |
| dex-requirements-reviewer | requirements-reviewer | `/review-requirements` | Приёмка чужого набора требований (`/review-requirements`) |
| dex-self-reviewer | self-reviewer | `/self-review` | Pre-push саморевью своей ветки с прогоном тестов |
| dex-stand-reviewer | stand-reviewer | - | Приёмка слитой фичи на развёрнутом стенде против ТЗ, read-only |

Команды зон движка (`/mr-review`, `/review-plan`, `/implement`, `/test` и прочие) живут в плагинах `dex-sdlc-<зона>`, а не в плагине специалиста: специалист несёт агента, движок `dex-sdlc` ставится вместе с любой зоной. См. «AI-SDLC» ниже. Собственные команды остаются у `/self-review`, `/resolve-conflicts` и прочих, помеченных в колонке. Стек кодера (агент, не skills) добирается профильным бандлом (`dotnet-developer` / `ts-fullstack`); skills по стеку грузятся условно.


## AI-SDLC: движок и зоны

Конвейер собран в три слоя: **движок** `dex-sdlc:engine` (универсальный цикл, делегирование, возобновление по ledger), **треки-скиллы** `dex-skill-<зона>-track` (порядок работ своей зоны) и **узлы** - агенты-специалисты, которых трек спавнит на исполнение. Команда-вход лежит в плагине своей зоны, движок ставится вместе с любой из них.

| Плагин | Команды | Зона |
|--------|---------|------|
| dex-sdlc | хук, своих команд нет | движок: универсальный цикл, делегирование, ledger возобновления |
| dex-sdlc-product | `/product` | продукт: корпус уровня 0 (BRD продукта, словарь, конституция) |
| dex-sdlc-requirements | `/feature-check`, `/feature` | требования: `UC`, `FR`/`NFR` с методом проверки, истории с `AC` |
| dex-sdlc-design | `/design` | дизайн: reference match, альтернативы, implementation-план |
| dex-sdlc-discover | `/discover` | обзорное ревью существующего кода вширь |
| dex-sdlc-delivery | `/implement` | разработка: реализация фичи полным циклом |
| dex-sdlc-test | `/find-bugs`, `/test` | тест-инжиниринг: добор покрытия, активный поиск багов |
| dex-sdlc-review | `/mr-review`, `/review-plan` | ревью: первичное ревью чужого MR/PR и план правок по нему |
| dex-sdlc-acceptance | `/review-stand` | приёмка слитой фичи на развёрнутом стенде |
| dex-sdlc-ops | `/investigate`, `/root-cause` | диагностика: расследование инцидента, поиск корневой причины |
| dex-sdlc-docs | `/documentation` | документирование по жанру и стандарту |
| dex-sdlc-nudge | хук, своих команд нет | подталкивание: поднимает движок на рабочей просьбе |
| dex-sdlc-resume | хук, своих команд нет | возобновление: напоминает продолжить цель после свёртки контекста |

## Skills (Level 1)

Базы знаний - активируются автоматически по ключевым словам в контексте либо грузятся агентом явно. Имя плагина - `dex-skill-<имя скилла>`, единственное исключение - движок `dex-sdlc:engine`. Перечень полный: сверяется с деревом `plugins/` генератором таблицы.

| Категория | Skills |
|-----------|--------|
| **Движок SDLC и его треки** | `engine`, `product-track`, `analytics-track`, `architecture-track`, `development-track`, `bugfix-track`, `followup-track`, `acceptance-track`, `discover-track`, `test-track`, `mr-review-track`, `documentation-track`, `diagnostics-track` |
| **Контракт и адресация артефактов** | `node-contract`, `docs-layout`, `project-docs-map`, `issue-tracking`, `artifact-naming`, `unit-identity`, `decision-log`, `stack-registry` |
| **Требования и продукт** | `idea-forming`, `opportunity-canvas`, `product-discovery`, `agile`, `epic-planning`, `prioritization`, `user-stories`, `use-cases`, `use-cases-cockburn`, `functional-requirements`, `nfr`, `bpmn`, `business-analysis-29148`, `system-requirements-29148`, `doc-standards` |
| **Оракулы качества артефактов** | `requirement-quality`, `requirement-set-quality`, `use-case-quality`, `adr-quality`, `design-quality`, `plan-quality`, `api-spec-quality`, `completeness-mapping`, `fact-verification`, `legacy-reconstruction`, `verification-planning-29119`, `bdd-gherkin` |
| **Архитектура и дизайн** | `clean-architecture`, `ddd`, `microservices`, `solid`, `scalability`, `cap-consistency`, `capacity-planning`, `distributed-resilience`, `reference-architectures`, `tech-evaluation`, `api-specification`, `architecture-definition-42010`, `interface-definition-openapi` |
| **Безопасность** | `owasp-security` |
| **Ревью и дисциплина изменений** | `git-workflow`, `merge-conflict-resolution`, `review-evidence`, `review-step-by-step`, `review-threads`, `no-loose-ends`, `performance-review`, `post-merge-remediation`, `ci-gates`, `project-baseline`, `codebase-conventions`, `karpathy-guidelines`, `optimize-for-llm`, `output-hygiene`, `artifact-review` |
| **QA и тестирование** | `test-design`, `api-testing`, `test-coverage`, `testability`, `integration-boundary`, `exploratory-testing`, `bug-reproduction`, `contract-drift`, `deep-audit`, `tech-audit`, `playwright`, `stand-verification` |
| **Инциденты и RCA** | `problem-specification`, `root-cause-analysis`, `change-correlation`, `shared-stand-safety`, `core-dumps`, `managed-debug`, `native-debug`, `perf-profiling`, `syscall-tracing`, `binary-inspection` |
| **.NET** | `dotnet-api-development`, `dotnet-async-patterns`, `dotnet-caching`, `dotnet-code-quality`, `dotnet-config-hygiene`, `dotnet-csproj-hygiene`, `dotnet-di`, `dotnet-ef-core`, `dotnet-linq-optimization`, `dotnet-logging`, `dotnet-resilience`, `dotnet-resources`, `dotnet-testing-patterns`, `dotnet-validation`, `api-documentation` |
| **Frontend и TypeScript** | `react`, `ts-patterns`, `ts-nodejs-api`, `ts-vitest-jest` |
| **Инфраструктура** | `docker`, `kubernetes`, `rabbitmq`, `kafka`, `elasticsearch`, `redis`, `mongodb`, `gitlab-ci`, `github-actions`, `jenkins`, `teamcity`, `observability` |
| **ML и Python** | `python-pytorch`, `python-tensorflow`, `python-classical-ml`, `python-nlp-transformers`, `python-computer-vision`, `python-ml-optimization`, `python-project-hygiene` |

## Utilities (Level 1)

Сгруппированы по назначению. Подробный гайд по CLI-утилитам - установка бинарей, конфигурация, CLI vs MCP - см. [docs/CLI_UTILITIES.md](./docs/CLI_UTILITIES.md). Установить все CLI-плагины одной командой: `./install-bundle/install-bundle.sh cli-tools`.

### CLI Tools - VCS & CI/CD

| Плагин | Описание | Бинарь |
|--------|----------|--------|
| dex-github-cli | Workflow runs, PRs, Actions logs | `gh` |
| dex-gitlab-cli | Pipelines, MRs, job logs | `glab` |
| dex-jenkins-cli | Jobs, builds, console output | REST API |
| dex-teamcity-cli | Builds, agents, build logs | REST API |

### CLI Tools - Tracker

| Плагин | Описание | Бинарь |
|--------|----------|--------|
| dex-jira-cli | Issues, JQL search, sprints (read-only) | `jira` |

### CLI Tools - Infrastructure & Data

| Плагин | Описание | Бинарь |
|--------|----------|--------|
| dex-kubectl-cli | Pods, logs, deployments, events, контексты | `kubectl` |
| dex-psql-cli | Read-only запросы, схема, EXPLAIN, locks | `psql` |
| dex-redis-cli | Server info, scan ключей, memory, monitor | `redis-cli` |
| dex-kaf-cli | Topics, consumer groups, consume, produce | [`kaf`](https://github.com/birdayz/kaf) |
| dex-rabbitmqadmin-cli | Overview, queues, bindings, publish | [`rabbitmqadmin-ng`](https://github.com/rabbitmq/rabbitmqadmin-ng) |
| dex-aws-s3-cli | List, bucket info, head-object, presigned URL | `aws s3` / `s3api` |

### CLI Tools - Debug

| Плагин | Описание | Бинарь |
|--------|----------|--------|
| dex-netcoredbg-cli | Attach и launch .NET-процесса, MI2 batch, дамп managed-стеков | [`netcoredbg`](https://github.com/Samsung/netcoredbg) |

### CLI Tools - Browser testing

| Плагин | Описание | Бинарь |
|--------|----------|--------|
| dex-playwright-cli | Run tests, show HTML report, codegen, trace viewer, install браузеров | `npx playwright` |

### Notifications & Helpers

| Плагин | Описание |
|--------|----------|
| dex-telegram-notifier | Telegram уведомления о событиях Claude Code |
| dex-discord-notifier | Discord уведомления о событиях Claude Code |
| dex-mcp-inspector | MCP Inspector: тестирование и отладка MCP серверов |

### Анализ репозитория и извлечение уроков

| Плагин | Команды | Описание |
|--------|---------|----------|
| dex-codebase-analyzer | `/codebase-summary`, `/codebase-graph`, `/codebase-pack` | Обзор стека, граф зависимостей и упаковка репозитория для архитектурной сессии |
| dex-knowledge-extractor | `/mr-collect`, `/mr-analyze`, `/mr-apply` | Извлечение уроков из чужих MR в правки каталога. Авторский плагин: работает в клоне репозитория маркетплейса |

### Установка самих CLI-бинарей (Linux + macOS)

```bash
# Что есть, чего не хватает
./install-bundle/install-cli-tools.sh --check

# Поставить всё недостающее (apt / dnf / pacman / apk / brew - авто-детект)
./install-bundle/install-cli-tools.sh --all

# Точечно
./install-bundle/install-cli-tools.sh psql redis-cli kaf rabbitmqadmin aws
```

Windows: `install-bundle\install-cli-tools.ps1` (winget / scoop / choco).

## MCP Servers

MCP конфигурации в каталоге `mcp/`. Подробнее: [mcp/README.md](./mcp/README.md)

| Роль | Required | Optional |
|------|----------|----------|
| .NET Developer | gitlab | genai-toolbox, rabbitmq, kafka, docker, seq, kubernetes |
| Architect | github, gitlab | notion, filesystem |
| DevOps | gitlab | docker, kubernetes, sentry |
| Product Manager | notion | - |
| System Analyst | pdf-reader | notion, google-drive |
| QA Engineer | gitlab | filesystem |
| ML Engineer | gitlab | mlflow, wandb, huggingface |

Настройка credentials: [CREDENTIALS.md](./CREDENTIALS.md)

## Документация каталога

Нормативы, по которым каталог собирается и судится, лежат в `docs/`. В установленный плагин они не входят - это дом авторских правил, не рантайм.

| Документ | О чём |
|----------|-------|
| [AGENT_FRAMEWORK.md](./docs/AGENT_FRAMEWORK.md) | как устроен агент: фаза-контракт, стандартный вход и выход, рецепты ролей, frontmatter |
| [SKILL_FRAMEWORK.md](./docs/SKILL_FRAMEWORK.md) | как устроен skill: жанры, поле активации, границы, размер |
| [COMMAND_FRAMEWORK.md](./docs/COMMAND_FRAMEWORK.md) | как устроена команда-вход и чем она отличается от агента |
| [VALIDATOR_RULES.md](./docs/VALIDATOR_RULES.md) | реестр правил валидаторов: что ловит каждое и где живёт его норма |
| [CORPUS.md](./docs/CORPUS.md) | корпус проекта на диске: носители, уровни артефакта, ключи путей, кто судит |
| [DEV_PROCESS_COVERAGE.md](./docs/DEV_PROCESS_COVERAGE.md) | карта «слот процесса разработки -> агент, который его закрывает» |
| [standards/](./docs/standards/) | реестр внешних стандартов (ISO/IEEE/ГОСТ) со статусом сверки каждого факта |
| [pipelines/](./docs/pipelines/) | дизайн конвейера требований: нормы этапов, порядок работ, реализация |
| [adr/](./docs/adr/) | решения по самому каталогу |
| [CLI_UTILITIES.md](./docs/CLI_UTILITIES.md) | установка CLI-бинарей, конфигурация, CLI против MCP |

Прогоны и фикстуры - [tests/README.md](./tests/README.md): трассировка, живой прогон, прогон активации скилла и видимости агента.

## Структура проекта

```
claude-code-marketplace/
├── plugins/
│   ├── ai-sdlc/                   # Движок конвейера, команды зон, треки
│   │   ├── dex-sdlc/              #   движок (skill engine)
│   │   ├── dex-sdlc-requirements/ #   команда-вход зоны
│   │   ├── dex-skill-analytics-track/
│   │   └── ...
│   ├── skills/                    # Level 1: базы знаний
│   │   ├── dex-skill-agile/
│   │   ├── dex-skill-dotnet-ef-core/
│   │   └── ...
│   ├── utilities/                 # Level 1: инструменты и CLI-обёртки
│   │   ├── dex-github-cli/
│   │   ├── dex-psql-cli/
│   │   ├── dex-telegram-notifier/
│   │   └── ...
│   ├── specialists/               # Level 2: агенты, каталог = категория
│   │   ├── architecture/
│   │   ├── delivery/
│   │   ├── dotnet/
│   │   ├── fullstack/
│   │   ├── infrastructure/
│   │   ├── ml/
│   │   ├── product/
│   │   ├── qa/
│   │   └── review/
│   └── bundles/                   # Level 3: наборы
│       ├── dex-bundle-dotnet-developer/
│       └── ...
├── docs/                          # Фреймворки, нормативы, ADR каталога
├── tests/                         # Фикстуры правил, прогоны, активация
├── tools/                         # Валидаторы, раннер правил, генератор витрины
├── install-bundle/                # Скрипты установки/удаления
├── mcp/                           # MCP server конфигурации
├── run-claude/                    # Конфигурация запуска
├── .claude-plugin/
│   └── marketplace.json           # Каталог всех плагинов (генерируется)
├── CLAUDE.md
├── CREDENTIALS.md
└── README.md
```

## Технологический стек

Стеки, под которые заточены специалисты и skills:

**`.NET`** - .NET 8.0+ (async/await + CancellationToken), Entity Framework Core, xUnit + Moq, RabbitMQ + MassTransit, Elasticsearch, Redis + StackExchange.Redis, Serilog + Seq, Docker, Kubernetes, GitLab CI.

**`TS/JS`** - TypeScript fullstack: Node.js/Bun backend (Express/Fastify/Hono), React frontend, Vitest/Jest для тестов.

**Python ML** - Python 3.10+, PyTorch, TensorFlow/Keras, scikit-learn, XGBoost, HuggingFace Transformers, MLflow, Weights & Biases, Optuna, ONNX, TFLite, FastAPI.

## Требования

- **Claude Code** - последняя версия
- **jq** - для install-скриптов на Linux/macOS
- **Credentials** - API-ключи для MCP-интеграций (см. [CREDENTIALS.md](./CREDENTIALS.md))

Под разные части маркетплейса нужны разные инструменты:

| Что ставите | Linux | macOS |
|---|---|---|
| Плагины бандлов (`install-bundle.sh`) | `jq` + `claude` | `brew install jq` + `claude` |
| CLI-бинари (`install-cli-tools.sh`) | apt / dnf / pacman / apk (авто-детект) | Homebrew (`brew`) |
| npx-MCP и `dex-playwright-cli` | Node.js (`setup/npx-install/install.sh`) | Node.js (`brew install node`) |
| uvx-MCP (gitlab, rabbitmq, docker, mlflow) | uv (`setup/uvx-install/install.sh`) | тот же скрипт (uv ставит свой установщик, brew не нужен) |
| Нотификаторы (telegram / discord) | `jq` + `curl` | `jq` + `curl` (в составе macOS) |

## Поддержка платформ

- **Linux** - основной путь. Bash-скриптам нужен один из пакетных менеджеров (apt / dnf / pacman / apk).
- **macOS** - поддержан, Intel и Apple Silicon. Bash-скрипты работают на стоковом `/bin/bash` 3.2 (отдельный bash через Homebrew не требуется); CLI-бинари ставятся через Homebrew. Часть низкоуровневых утилит ограничена платформой: `netcoredbg` и `valgrind` не собираются под Apple Silicon (arm64), а `strace` / `bpftrace` / `bcc` / `perf` доступны только на Linux. Полная матрица по CLI-утилитам - [docs/CLI_UTILITIES.md](./docs/CLI_UTILITIES.md), по MCP-серверам - [mcp/README.md](./mcp/README.md).
- **Windows** - через PowerShell-скрипты (`*.ps1`) или WSL.

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

GPL v3.0 - см. [LICENSE](./LICENSE)

---

**DEX Team** · Version 5.85.0
