# Claude Code Marketplace для команд разработки

> Коллекция специализированных AI-ассистентов для каждой роли в команде разработки

## О проекте

Claude Code Marketplace — это набор из 7 профессиональных плагинов, каждый из которых настроен под конкретную роль в команде:

- **🔵 .NET Development** — разработка и архитектура .NET приложений
- **🐍 Python ML Development** — машинное обучение и AI разработка
- **📊 Product & Analysis** — продуктовый менеджмент и системный анализ
- **🧪 Quality & Operations** — тестирование и DevOps

Каждый плагин включает:
- **Agents** — специализированные AI-ассистенты для конкретных задач
- **Commands** — slash-команды для быстрых операций
- **Skills** — базы знаний с best practices и примерами кода
- **MCP Integrations** — подключения к внешним сервисам (GitLab, Notion, MLflow и др.)

## Быстрый старт

### 1. Установка

Плагины устанавливаются локально в директорию `.claude/plugins/`:

```bash
# Клонируйте репозиторий
git clone https://github.com/dex-it/claude-code-marketplace.git

# Скопируйте нужные плагины
cp -r claude-code-marketplace/plugins/dex-dotnet-developer ~/.claude/plugins/
cp -r claude-code-marketplace/plugins/dex-python-ml-developer ~/.claude/plugins/
# ... и так далее для других плагинов
```

### 2. Настройка Credentials

Большинство плагинов требуют API ключи для интеграции с внешними сервисами (GitLab, Notion, GitHub и др.).

**📖 См. полное руководство:** [CREDENTIALS.md](./CREDENTIALS.md)

**Быстрая настройка:**

```bash
# Экспортируйте необходимые переменные окружения
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
export NOTION_TOKEN="ntn_xxxxxxxxxxxxx"
export GITHUB_TOKEN="ghp-xxxxxxxxxxxxx"  # Для dex-dotnet-architect

# Для Python ML разработки:
export MLFLOW_TRACKING_URI="http://localhost:5000"
export WANDB_API_KEY="xxxxxxxxxxxxx"
export HUGGINGFACE_TOKEN="hf-xxxxxxxxxxxxx"

# Запустите Claude Code
claude
```

**Проверка конфигурации:**

```bash
# В Claude Code выполните:
/mcp list

# Вы должны увидеть подключенные MCP серверы
```

---

## Плагины

### 🔵 .NET Development

#### dex-dotnet-developer

**Для кого:** .NET разработчики, пишущие код ежедневно

**Описание:** Полноценный ассистент для .NET разработки с поддержкой C#, ASP.NET Core, Entity Framework Core, LINQ, async/await patterns и best practices.

**MCP Интеграции:**
- ✅ GitLab — version control, CI/CD
- ✅ Notion — документация, notes
- 🔵 Supabase/PostgreSQL — database access (optional)

**Команды:**
- `/build` — компиляция проекта с анализом ошибок
- `/test` — запуск тестов с детальным отчётом
- `/debug` — помощь в отладке и поиске багов
- `/ef-migration` — создание EF Core миграций
- `/refactor` — рефакторинг кода с best practices

**Agents:**
- `coding-assistant` — написание нового кода
- `bug-hunter` — поиск и исправление багов
- `code-reviewer` — code review и улучшения
- `test-writer` — генерация unit/integration тестов

**Skills:** dotnet-patterns, ef-core, async-patterns, linq-optimization, api-development, testing-patterns

[**→ Подробная документация**](./plugins/dex-dotnet-developer/README.md)

---

#### dex-dotnet-architect

**Для кого:** .NET архитекторы, проектирующие системы

**Описание:** Инструменты для архитектурного проектирования: Clean Architecture, DDD, Microservices, ADR (Architecture Decision Records), C4 diagrams.

**MCP Интеграции:**
- ✅ GitHub — ADR versioning, diagram storage
- ✅ GitLab — code analysis, architecture review
- ✅ Notion — architecture documentation
- ✅ Filesystem — local diagrams and docs

**Команды:**
- `/design` — архитектурное проектирование решений
- `/adr` — создание Architecture Decision Records
- `/review` — architecture review и анализ

**Agents:**
- `architect` — solution architecture design
- `adr-writer` — ADR documentation
- `diagram-creator` — C4 diagrams, sequence diagrams

**Skills:** clean-architecture, ddd-patterns, microservices, cqrs-event-sourcing

[**→ Подробная документация**](./plugins/dex-dotnet-architect/README.md)

---

### 🐍 Python ML Development

#### dex-python-ml-developer

**Для кого:** Python ML/AI разработчики, Data Scientists

**Описание:** Comprehensive ML toolkit с поддержкой PyTorch, TensorFlow, scikit-learn, HuggingFace Transformers, computer vision, NLP, classical ML, hyperparameter tuning, deployment.

**MCP Интеграции:**
- ✅ MLflow — experiment tracking, model registry
- ✅ Weights & Biases — rich visualizations, collaboration
- ✅ HuggingFace — models/datasets hub access
- ✅ GitLab — version control, ML pipelines
- ✅ Notion — experiment documentation

**Команды:**
- `/train` — обучение моделей с tracking
- `/evaluate` — метрики, confusion matrix, визуализации
- `/tune` — hyperparameter tuning (Optuna, Ray Tune)
- `/profile` — FLOPs, memory, latency analysis
- `/convert` — export to ONNX, TensorRT, TFLite
- `/serve` — generate FastAPI server

**Agents:**
- `ml-experimenter` — EDA, feature engineering, baseline models
- `model-trainer` — training для всех фреймворков
- `model-debugger` — debugging training issues
- `deployment-assistant` — ONNX export, FastAPI deployment
- `data-pipeline-builder` — efficient DataLoaders

**Skills:** pytorch-patterns, tensorflow-patterns, classical-ml, nlp-transformers, computer-vision, ml-optimization

[**→ Подробная документация**](./plugins/dex-python-ml-developer/README.md)

---

### 📊 Product & Analysis

#### dex-product-manager

**Для кого:** Product managers, product owners

**Описание:** Инструменты для продуктового менеджмента: product discovery, prioritization frameworks, roadmap planning, backlog management, metrics tracking.

**MCP Интеграции:**
- ✅ Notion — roadmaps, backlogs, documentation

**Команды:**
- `/roadmap` — планирование product roadmap
- `/prioritize` — prioritization frameworks (RICE, ICE, WSJF)
- `/backlog` — backlog management

**Agents:**
- `product-strategist` — product strategy, vision
- `feature-prioritizer` — feature prioritization
- `metrics-analyst` — metrics analysis, KPIs

**Skills:** product-discovery, prioritization

[**→ Подробная документация**](./plugins/dex-product-manager/README.md)

---

#### dex-system-analyst

**Для кого:** Системные аналитики, бизнес-аналитики

**Описание:** Requirements analysis, User Stories (INVEST), BPMN process modeling, OpenAPI specifications, acceptance criteria.

**MCP Интеграции:**
- ✅ Notion — requirements, User Stories, documentation
- ✅ PDF Reader — чтение и анализ PDF документов (спецификации, контракты)
- 🔵 Google Drive — работа с Google Docs, Sheets, Slides (опционально)

**Команды:**
- `/write-story` — создание User Stories с acceptance criteria
- `/api-spec` — OpenAPI 3.0 specification generation

**Agents:**
- `requirements-analyst` — requirements gathering, stakeholder analysis
- `user-story-writer` — User Stories, acceptance criteria
- `process-modeler` — BPMN diagrams, workflow design

**Skills:** agile-fundamentals, user-stories, bpmn-modeling, api-specification, doc-worker

[**→ Подробная документация**](./plugins/dex-system-analyst/README.md)

---

### 🧪 Quality & Operations

#### dex-quality-assurance

**Для кого:** QA инженеры, тестировщики

**Описание:** Test design, test automation (Playwright, Selenium), API testing, bug reporting, test coverage analysis.

**MCP Интеграции:**
- ✅ GitLab — bug tracking, test case management, CI/CD

**Команды:**
- `/analyze-story` — анализ User Story для тестирования
- `/create-tests` — генерация автотестов (Playwright/Selenium)

**Agents:**
- `test-analyst` — test case creation, test design
- `test-automator` — Playwright/Selenium test generation
- `bug-reporter` — structured bug reports

**Skills:** test-design, api-testing

[**→ Подробная документация**](./plugins/dex-quality-assurance/README.md)

---

#### dex-devops

**Для кого:** DevOps инженеры, SRE

**Описание:** GitLab CI/CD pipelines, Docker containerization, Kubernetes deployment, infrastructure as code.

**MCP Интеграции:**
- ✅ GitLab — CI/CD pipelines, infrastructure, monitoring

**Команды:**
- `/pipeline` — создание GitLab CI/CD pipelines
- `/dockerfile` — генерация оптимизированных Dockerfile
- `/deploy` — Kubernetes deployment manifests

**Agents:**
- `pipeline-expert` — GitLab CI/CD configuration
- `docker-builder` — Docker optimization, multi-stage builds
- `k8s-specialist` — Kubernetes deployment, scaling

**Skills:** gitlab-ci, docker-best-practices, kubernetes

[**→ Подробная документация**](./plugins/dex-devops/README.md)

---

## MCP Servers

MCP конфигурации централизованы в папке `mcp/`. Плагины не содержат `.mcp.json` файлов.

### Быстрая настройка

1. Посмотрите в `plugin.json` поле `mcpServers` — какие серверы нужны плагину
2. Скопируйте нужные серверы из `mcp/mcp-template.json` в свой `.mcp.json`
3. Настройте переменные окружения в `.env` (см. `run-claude/sample.env`)
4. Проверьте: `/mcp list`

### MCP серверы по плагинам

| Плагин | Required | Optional |
|--------|----------|----------|
| **dex-product-manager** | notion | - |
| **dex-system-analyst** | pdf-reader | notion, google-drive |
| **dex-dotnet-developer** | gitlab, notion | postgres, rabbitmq, elasticsearch, redis, docker, seq, kubernetes |
| **dex-dotnet-architect** | github, gitlab, notion | filesystem |
| **dex-python-ml-developer** | gitlab | notion, mlflow, wandb, huggingface |
| **dex-quality-assurance** | gitlab | filesystem |
| **dex-devops** | gitlab | - |

**Подробная документация:** [mcp/README.md](./mcp/README.md)

**Получение API ключей:** [CREDENTIALS.md](./CREDENTIALS.md)

---

## Требования

- **Claude Code** — latest version
- **Credentials** — API ключи для нужных интеграций (см. [CREDENTIALS.md](./CREDENTIALS.md))
- **Node.js** — для MCP серверов на `npx` (Notion, Weights & Biases, HuggingFace)
- **Python** — для MCP серверов на `uvx` (GitLab, MLflow)

---

## Структура проекта

```
claude-code-marketplace/
├── CREDENTIALS.md              # Руководство по настройке credentials
├── README.md                   # Этот файл
├── LICENSE                     # GPL v3.0
├── CLAUDE.md                   # Проектные инструкции для Claude Code
│
├── mcp/                        # Централизованный каталог MCP серверов
│   ├── README.md              # Документация по настройке MCP
│   └── mcp-template.json      # Все 16 MCP серверов в одном файле
│
├── run-claude/                 # Папка для запуска Claude Code
│   ├── .mcp.json              # Конфигурация MCP серверов (пример)
│   ├── .env                   # Переменные окружения (не коммитить!)
│   ├── sample.env             # Шаблон .env файла
│   ├── settings.json          # Настройки Claude Code
│   ├── system-prompt.md       # Системный промпт для проекта
│   └── run-claude.sh/.ps1     # Скрипты запуска
│
├── plugins/                    # Плагины для разных ролей
│   ├── dex-dotnet-developer/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json   # + mcpServers field
│   │   ├── README.md
│   │   ├── agents/
│   │   ├── commands/
│   │   ├── skills/
│   │   └── hooks/
│   │
│   ├── dex-dotnet-architect/
│   ├── dex-python-ml-developer/
│   ├── dex-product-manager/
│   ├── dex-system-analyst/
│   ├── dex-quality-assurance/
│   └── dex-devops/
```

---

## Contributing

Мы приветствуем contribution! Если вы хотите:

- Добавить новый плагин для другой роли
- Улучшить существующие агенты/команды/skills
- Исправить баги или улучшить документацию

**Как внести изменения:**

1. Fork репозиторий
2. Создайте ветку для вашей фичи (`git checkout -b feature/amazing-feature`)
3. Следуйте существующей структуре плагинов
4. Убедитесь что все примеры кода работают
5. Обновите документацию
6. Создайте Pull Request

**Стандарты качества:**

- **Agents:** 130-180 строк, bilingual triggers, production-ready примеры
- **Commands:** 55-70 строк, structured process, clear output format
- **Skills:** 180-250 строк, 80% code examples, best practices + anti-patterns
- **README:** Configuration section, Quick Start, Best Practices, Troubleshooting

---

## Roadmap

### Планируются новые плагины:

- **dex-frontend-developer** — React, Vue, Angular, TypeScript
- **dex-mobile-developer** — React Native, Flutter, Swift
- **dex-data-engineer** — Airflow, Spark, dbt, data pipelines
- **dex-security-engineer** — Security audits, OWASP, penetration testing

### Улучшения существующих плагинов:

- Интеграция с Jira для issue tracking
- Confluence для документации
- Jenkins/GitHub Actions для CI/CD
- Elasticsearch для логов и мониторинга

---

## Поддержка

**Документация:**
- [CREDENTIALS.md](./CREDENTIALS.md) — настройка API ключей
- [CLAUDE.md](./CLAUDE.md) — инструкции для разработки плагинов
- README каждого плагина — детальная документация

**Issues:**
Если вы столкнулись с проблемой:
1. Проверьте секцию Troubleshooting в README плагина
2. Убедитесь что credentials настроены корректно
3. Проверьте `/mcp list` что MCP серверы подключены
4. Создайте issue в GitHub с описанием проблемы

**Вопросы:**
- GitHub Issues — для багов и feature requests
- GitHub Discussions — для вопросов и идей

---

## License

GPL v3.0 — см. [LICENSE](./LICENSE)

---

## Авторы

**DEX Team**

**Version:** 3.0.0
**Last Updated:** 2025-11-26

---

**Теги:** claude-code, ai-assistant, dotnet, python, ml, product-management, qa, devops, clean-architecture, ddd, microservices, mlops
