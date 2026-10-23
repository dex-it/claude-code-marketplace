<p align="center">
  <img alt="DEX AI KIT" src="assets/dexaikit-banner-light.svg#gh-light-mode-only" width="420">
  <img alt="DEX AI KIT" src="assets/dexaikit-banner-dark.svg#gh-dark-mode-only" width="420">
</p>

<h1 align="center">Набор для агентной разработки</h1>

<p align="center">
  <b>Знания о стеке, роли, порядок работы и инструменты для Claude Code - собранные так, чтобы агент вёл задачу от идеи до pull request, а решения оставались за вами.</b>
</p>

<p align="center">
  Памятки по стекам, специалисты с понятными ролями, команды, которые ведут работу по шагам, и инструменты, которые достают до кластера, базы и трекера прямо из чата.<br>
  Детали подогнаны друг к другу, но берутся по отдельности: набором под роль или по одной.
</p>

<p align="center">
  <a href="https://github.com/dex-it/claude-code-marketplace/actions/workflows/validate-agents.yml"><img alt="Validate Plugins" src="https://github.com/dex-it/claude-code-marketplace/actions/workflows/validate-agents.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="Лицензия: GPL v3.0" src="https://img.shields.io/badge/license-GPL%20v3.0-blue.svg"></a>
</p>

<p align="center">
  <a href="https://dex-it.github.io/claude-code-marketplace/"><b>Сайт документации</b></a> |
  <a href="#быстрый-старт">Быстрый старт</a> |
  <a href="#что-вы-получите">Что вы получите</a> |
  <a href="#от-идеи-до-pr">От идеи до PR</a> |
  <a href="#что-внутри">Что внутри</a> |
  <a href="#бандлы">Бандлы</a> |
  <a href="#полный-каталог">Весь набор</a> |
  <a href="#как-это-устроено">Как это устроено</a> |
  <a href="#участие">Участие</a>
</p>

---

## Быстрый старт

Поставим набор для работы с кодом и проверим свою ветку перед push.

**1. Подключите AI KIT** (один раз; для Claude Code это маркетплейс - источник плагинов):

```bash
claude plugin marketplace add dex-it/claude-code-marketplace
```

То же изнутри Claude Code: `/plugin marketplace add dex-it/claude-code-marketplace`.

**2. Поставьте бандл** `code-review` (нужны `git`, `claude` и `jq`):

```bash
git clone https://github.com/dex-it/claude-code-marketplace.git
cd claude-code-marketplace
./install-bundle/install-bundle.sh code-review
```

**3. Запустите в своём проекте:**

```bash
cd путь/к/вашему/проекту
claude
```

```
/dex-self-reviewer:self-review
```

Что вы увидите: Claude сравнит вашу ветку с базовой (с учётом незакоммиченного), реально прогонит сборку и тесты и выдаст чеклист правок до push: блокеры, важное, замечания. Файлы он не меняет, пока вы не скажете «делай».

> [!TIP]
> Сначала посмотреть, что поставится: добавьте `--dry-run`. Все бандлы: `./install-bundle/install-bundle.sh --list`. На Windows - `.\install-bundle\install-bundle.ps1 code-review`.

<details>
<summary><b>Другие способы установки и удаление</b></summary>

**Один плагин вместо бандла.** Плагины ставятся по формату `имя@dex-claude-marketplace`:

```bash
claude plugin install dex-dotnet-coder@dex-claude-marketplace            # специалист
claude plugin install dex-skill-dotnet-ef-core@dex-claude-marketplace    # памятка по стеку
claude plugin install dex-telegram-notifier@dex-claude-marketplace       # утилита
```

> [!NOTE]
> Установка плоская: «специалист плюс его памятки» сами не подтягиваются. Специалист без нужных ему skills запустится, но будет работать без них. Бандл ставит всё сразу; для уже поставленных агентов недостающее докладывает `./install-bundle/sync-plugins.sh --fix`.

**Что установлено и как убрать:**

```bash
claude plugin list                                        # установленные плагины
./install-bundle/uninstall-bundle.sh code-review          # удалить бандл
claude plugin uninstall dex-dotnet-coder                  # удалить один плагин
```

Установщики снятые плагины не удаляют: переименованные и снятые имена перечислены в таблице `Renamed and removed plugins` файла [install-bundle/README.md](./install-bundle/README.md).

</details>

## Что вы получите

Выберите задачу - и берите бандл с командой.

| Хочу | Ставлю бандл | Запускаю |
|------|--------------|----------|
| Проверить свою ветку перед push | `code-review` | `/dex-self-reviewer:self-review` |
| Отревьюить чужой MR или PR с комментариями в тредах | `code-review` | `/dex-mr-reviewer:mr-review` |
| Найти причину бага по коду, поискать баги в фиче | `bug-lifecycle` | `/dex-debugger:root-cause`, `/dex-bug-finder:find-bugs` |
| Разобрать инцидент на общем стенде | `bug-lifecycle` | `/dex-incident-investigator:investigate` |
| Собрать требования к фиче и проверить, что по ним можно начинать разработку | `system-analyst` | `/dex-business-analyst:feature`, `/dex-requirements-reviewer:feature-check` |
| Спроектировать решение с альтернативами | `architect` | `/dex-architect:design` |
| Реализовать фичу и добрать тесты на .NET или TypeScript | `dotnet-developer`, `ts-fullstack` | `/dex-implement:implement`, `/dex-test:test` |
| Отдать задачу целиком: от цели до PR | `auto` | `/dex-auto:onboard`, `/dex-auto:goal`, `/dex-auto:auto` |
| Смотреть кластер, БД и очереди прямо из чата | `cli-tools` | `/dex-kubectl-cli:kube-pods`, `/dex-psql-cli:psql-query`, `/dex-rabbitmqadmin-cli:rmq-queues` |

Польза есть и без команд: skills активируются сами, когда в контексте появляется их тема (Entity Framework, Kafka, Kubernetes и так далее).

> [!NOTE]
> Список выше - примеры. Все команды - в разделе [«Полный каталог»](#полный-каталог).

## От идеи до PR

Детали не лежат россыпью, а передают друг другу работу. Одна задача проходит по цепочке, и каждый шаг запускается отдельной командой: между шагами решаете вы.

| Шаг | Деталь | Команда |
|-----|--------|---------|
| Задача в Jira и постановка | `dex-jira-tracker` | `/jira`, `/jira spec` |
| Требования с критериями приёмки | `dex-business-analyst` | `/dex-business-analyst:feature` |
| Решение с альтернативами | `dex-architect` | `/dex-architect:design` |
| Код и тесты | `dex-implement`, `dex-test` | `/dex-implement:implement`, `/dex-test:test` |
| Проверка своей ветки перед push | `dex-self-reviewer` | `/dex-self-reviewer:self-review` |
| PR или MR и слежение за ним | `dex-jira-tracker`, `dex-github-pr-tracker`, `dex-gitlab-mr-tracker` | `/jira ship`, `/pr`, `/mr` |
| Ревью чужого PR | `dex-mr-reviewer` | `/dex-mr-reviewer:mr-review` |

Нужна не цепочка, а результат: `dex-auto` берёт цель и ведёт задачу сам, от тикета до PR (`/dex-auto:goal`, `/dex-auto:auto`).

## Что внутри

AI KIT собран из деталей шести видов. Деталь делает одно дело и подогнана к соседним: специалист подгружает нужные памятки, команда зовёт нужных специалистов. Поэтому из них собирается комплект под роль, а не свалка плагинов.

| Вид | Для чего | Пример |
|-----|----------|--------|
| **Skills** | Короткие памятки по теме или стеку: на что не наступать и как делать правильно. Claude подхватывает их сам, когда тема появляется в работе | `dotnet-ef-core`, `kafka`, `solid` |
| **Специалисты** | Агенты с узкой ролью и понятным порядком работы: ревьюер, дебаггер, архитектор, DevOps | `dex-mr-reviewer`, `dex-debugger` |
| **Команды** | Слэш-команды, с которых начинается работа: ведут порядок шагов через специалистов и skills | `/dex-mr-reviewer:mr-review`, `/dex-architect:design` |
| **Утилиты** | Обёртки над CLI (`gh`, `kubectl`, `psql` и другие), уведомления, анализ репозитория | `dex-kubectl-cli`, `dex-telegram-notifier` |
| **Бандлы** | Готовые наборы плагинов под роль, одной командой | `dotnet-developer`, `devops` |
| **Моды** | Меняют сам Claude Code: панели, строки над вводом, слежение за PR, задачами Jira и сессиями | `dex-github-pr-tracker` |

## Бандлы

Бандл - список плагинов под роль, кода в нём нет. Имя в первой колонке - аргумент `install-bundle.sh`.

| Bundle | Для кого и что ставит |
|--------|-----------------------|
| `dotnet-developer` | .NET разработчик: код, тесты, EF Core, ревью, баги |
| `dotnet-fullstack` | .NET плюс инфраструктура |
| `ts-fullstack` | TypeScript fullstack: Node.js/Bun и React |
| `devops` | DevOps инженер |
| `infrastructure` | Вся инфраструктура: CI/CD, брокеры, БД, мониторинг |
| `product-manager` | Product Manager |
| `system-analyst` | Системный аналитик: требования, сценарии, процессы, документы |
| `architect` | Архитектор: дизайн, диаграммы, обзорное ревью кода |
| `qa-engineer` | QA инженер |
| `ml-engineer` | ML инженер |
| `auto` | Агентская разработка на `dex-auto`: вход проекта, цель, автономные треки feature, bugfix и ревью |
| `code-review` | Цикл работы с кодом: ревью MR/PR, ре-ревью дельты, план правок, реализация фичи, саморевью перед push, свод правил проекта. Не привязан к языку |
| `bug-lifecycle` | Жизненный цикл бага: поиск, оформление, поиск причины на стенде, фикс на источнике. Не привязан к языку |
| `runtime-diagnostics` | Диагностика .NET: зависания, падения, утечки, дампы, netcoredbg |
| `cli-tools` | CLI-утилиты для диагностики: gh, glab, kubectl, jenkins, teamcity, psql, redis-cli, kaf, rabbitmqadmin, aws-s3, playwright |
| `market-editor` | Для автора каталога, не для пользователя: правка норм, ревью артефактов, извлечение уроков из чужих MR |

## Полный каталог

Всё, что есть в наборе. Разделы раскрываются. Единственный источник истины о составе - `.claude-plugin/marketplace.json`.

> [!NOTE]
> В таблицах ниже команды записаны коротким именем. В Claude Code команда плагина вызывается полной формой `/имя-плагина:команда`, например `/dex-self-reviewer:self-review`.

<details>
<summary><b>Команды</b> - точки входа в работу и плагины, в которых они лежат</summary>

Команда ведёт порядок работ: вызывает специалистов, спрашивает вас в нужных местах и сводит результаты. Плагин команды - тот, кому она делегирует. Команда, которая сама выбирает исполнителя по манифесту репозитория (язык, сборка), лежит в собственном плагине: `dex-implement`, `dex-test`.

| Плагин | Команды | Что делает |
|--------|---------|------------|
| dex-business-analyst | `/product`, `/feature` | Собирает описание продукта и требования фичи: сценарии, функциональные и нефункциональные требования с проверкой, истории с критериями приёмки |
| dex-requirements-reviewer | `/feature-check`, `/review-requirements` | Проверяет набор требований на готовность к разработке; принимает чужой набор |
| dex-architect | `/design`, `/review-arch` | Дизайн: сравнение с готовыми решениями, альтернативы, план реализации |
| dex-code-discovery | `/discover` | Обзорное ревью существующего кода вширь |
| dex-implement | `/implement` | Реализует фичу полным циклом до локальных коммитов |
| dex-test | `/test` | Добирает тестовое покрытие |
| dex-auto | `/onboard`, `/goal`, `/auto` | Автономная работа под открытую цель: подключает проект, готовит цель из тикета или спеки, ведёт feature, bugfix и ревью чужого MR. Ход работы записывается вне рабочего дерева, хуки умеют возобновить работу |
| dex-bug-finder | `/find-bugs` | Активный поиск багов в фиче или ветке |
| dex-mr-reviewer | `/mr-review` | Ревью чужого MR/PR и повторное ревью только изменений с прошлого раза |
| dex-self-reviewer | `/self-review` | Саморевью своей ветки перед push с реальным прогоном тестов |
| dex-review-planner | `/review-plan` | Разбор полученного ревью: план правок, ответы ревьюеру |
| dex-rulebook-miner | `/rulebook` | Свод правил проекта из истории ревью; публикует MR со сводом |
| dex-stand-reviewer | `/review-stand` | Приёмка слитой фичи на развёрнутом стенде |
| dex-incident-investigator | `/investigate` | Расследование инцидента на общем стенде |
| dex-debugger | `/root-cause` | Поиск корневой причины бага по коду |
| dex-doc-writer | `/documentation` | Документирование по жанру и стандарту |
| dex-skill-subagent-dispatch | `/do` | Выполняет задачу сам или цепочкой исполнителей (экспериментально) |

Остальные команды лежат в плагинах своих специалистов и утилит - смотрите разделы ниже.

> [!TIP]
> `dex-auto` подробно: [plugins/auto/dex-auto/README.md](./plugins/auto/dex-auto/README.md).

</details>

### Специалисты

Агенты с узкой специализацией. Как правило один плагин - один агент; исключения: `dex-code-discovery` и `dex-rulebook-miner` (оркестратор плюс исполнитель) и `dex-auto`. Разделы повторяют каталоги на диске: `plugins/specialists/<категория>/`; `dex-auto` лежит отдельно, в `plugins/auto/`.

<details>
<summary><b>Architecture</b> - ADR, API, дизайн, диаграммы, обзорное ревью кода</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-adr-writer | adr-writer | `/adr` | Architecture Decision Records |
| dex-api-designer | api-designer | `/api-docs` | REST API design, OpenAPI |
| dex-architect-dotnet | architect-dotnet | - | Дизайн-решение под .NET: сравнение с готовыми решениями, альтернативы с ASP.NET Core / EF Core / MassTransit, компромисс по CAP |
| dex-architect | architect | `/review-arch` | System design, patterns, trade-offs |
| dex-code-discovery | discover-orchestrator, discover-reviewer | - | Обзорное ревью существующего кода вширь: инвентаризация по топикам, severity под масштаб, запись в `docs/discover/` |
| dex-design-reviewer | design-reviewer | `/review-design` | Приёмка чужого дизайн-документа - спека, ADR, диаграммы до кода |
| dex-diagram-creator | diagram-creator | - | C4, sequence diagrams, Mermaid |

</details>

<details>
<summary><b>Delivery</b> - баги, инциденты, правки по ревью, безопасность</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-bug-fixer | bug-fixer | - | Пакетная ремедиация багов после мерджа: триаж, подтверждение причины, фикс на источнике, follow-up MR |
| dex-debugger | debugger | `/root-cause` | Языко-агностичный поиск корневой причины: красный воспроизводящий тест, изоляция, проверка гипотезы, список проблем без правки продуктового кода |
| dex-incident-investigator | incident-investigator | `/investigate` | Расследование инцидента на общем стенде, RCA и фикс на источнике, read-only по умолчанию |
| dex-review-planner | review-planner | `/review-plan` | План правок по ревью без редактирования кода |
| dex-security-reviewer | security-reviewer | `/security-scan` | Глубокий анализ безопасности: threat model, attack paths по OWASP, цепочки эксплойтов, severity |

</details>

<details>
<summary><b>.NET</b> - код, тесты, EF Core, производительность, диагностика рантайма</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-dotnet-coder | dotnet-coder | `/build`, `/refactor` | Написание кода, SOLID, паттерны |
| dex-dotnet-performance | dotnet-performance-analyst | `/health-check`, `/metrics` | Profiling, N+1, memory |
| dex-dotnet-quality-auditor | dotnet-quality-auditor | `/dotnet-quality-audit` | Аудит гигиены качества .NET: анализаторы, warning-профиль, NuGet audit, NSDepCop, CI-gates |
| dex-dotnet-runtime-diagnostician | dotnet-runtime-diagnostician | - | Диагностика .NET и native-границы: hang, crash, leak, дампы, netcoredbg |
| dex-dotnet-tester | dotnet-test-writer | - | Unit тесты, xUnit, Moq |
| dex-ef-specialist | dotnet-ef-specialist | `/ef-migration` | EF Core: migrations, queries, DbContext |

</details>

<details>
<summary><b>Fullstack</b> - TypeScript: Node.js/Bun и React</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-ts-fullstack-coder | ts-fullstack-assistant | - | TypeScript fullstack: Node.js/Bun + React |
| dex-ts-tester | ts-test-writer | - | Тесты TypeScript/JavaScript: Vitest/Jest, моки, fake timers, изоляция |

</details>

<details>
<summary><b>Infrastructure</b> - CI/CD, контейнеры, брокеры, БД, мониторинг</summary>

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

</details>

<details>
<summary><b>ML</b> - данные, обучение, отладка моделей, деплой</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-data-pipeline | data-pipeline-builder | - | Data loading, preprocessing |
| dex-ml-deployer | deployment-assistant | `/convert`, `/serve` | ONNX, TFLite, FastAPI |
| dex-ml-experimenter | ml-experimenter | - | EDA, feature engineering |
| dex-model-debugger | model-debugger | `/evaluate`, `/profile` | Debugging ML models |
| dex-model-trainer | model-trainer | `/train`, `/tune` | PyTorch, TensorFlow, sklearn |

</details>

<details>
<summary><b>Product</b> - требования, сценарии, BDD, бэклог, метрики</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-backlog-manager | backlog-manager | - | Epic backlog, prioritization |
| dex-bdd-author | bdd-author | `/bdd` | Исполняемые примеры: карта примеров, `.feature` на Gherkin с трассировкой на функциональные требования |
| dex-business-analyst | business-requirements-analyst | - | Бизнес-требования: BRD с нумерованными целями (`BR-NNN`) и мерой успеха |
| dex-doc-writer | doc-writer | - | Technical specs, API docs |
| dex-domain-analyst | domain-analyst | - | Словарь продукта и конституция: инварианты (`INV-NNN`) и сквозные меры (`NFR-P-NNN`) с основанием и методом проверки |
| dex-pm-metrics-analyst | metrics-analyst | - | KPIs, OKRs, metrics |
| dex-process-modeler | process-modeler | - | BPMN, workflows |
| dex-requirements-analyst | requirements-analyst | - | Требования системного уровня: функциональные и нефункциональные из бизнес-требований, пробелы, конфликты |
| dex-roadmap-planner | roadmap-planner | - | Strategic planning |
| dex-use-case-writer | use-case-writer | `/use-cases` | Сценарии по Cockburn: основной ход, расширения с терминалом, минимальные гарантии |
| dex-usecase-analyst | usecase-analyst | - | Сценарии из бизнес-требований: актор, основной ход, расширения |
| dex-user-story-analyst | user-story-analyst | - | User stories, acceptance criteria |

Зона требований целиком (идея, бизнес-требования, сценарии, функциональные требования, истории; на каждом гейте нужен апрув оператора) идёт через `/feature`, не отдельным агентом.

</details>

<details>
<summary><b>QA</b> - поиск и оформление багов, тест-дизайн, автотесты</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-bug-finder | bug-finder | - | Активный поиск багов: чартеры, адверсариальная охота, воспроизведение, передача дальше |
| dex-bug-reporter | bug-reporter | - | Bug reports, reproduction steps, передача на RCA |
| dex-test-analyst | test-analyst | - | Test design, coverage analysis |
| dex-test-automator | test-automator | - | Selenium, Playwright, API testing |

</details>

<details>
<summary><b>Review</b> - ревью MR/PR, саморевью, приёмка требований и стенда</summary>

| Плагин | Агент | Команда | Описание |
|--------|-------|---------|----------|
| dex-implementer-reader | implementer-reader | - | Проба готовности набора требований к разработке |
| dex-mr-check-reviewer | mr-check-reviewer | через `/mr-review`, своей нет | Повторное ревью изменений с прошлого ревью (range-diff) |
| dex-mr-reviewer | mr-reviewer | `/mr-review` | Первичное ревью чужого MR/PR, инлайн-треды через gh/glab |
| dex-requirements-reviewer | requirements-reviewer | `/review-requirements` | Приёмка чужого набора требований |
| dex-rulebook-miner | rulebook-orchestrator, rule-collector | `/rulebook` | Свод правил проекта из истории ревью: что в репозитории принято; нормы жанра, ловушки добычи и проверка приёмки едут skills этого же плагина |
| dex-self-reviewer | self-reviewer | `/self-review` | Саморевью своей ветки перед push с прогоном тестов |
| dex-stand-reviewer | stand-reviewer | - | Приёмка слитой фичи на развёрнутом стенде против ТЗ, read-only |

</details>

> [!NOTE]
> Команда лежит в плагине того специалиста, кому делегирует: `/mr-review` едет с `dex-mr-reviewer`, `/design` - с `dex-architect`. `/resolve-conflicts` лежит в плагине skill `merge-conflict-resolution`, агента у неё нет. Агент-кодер под ваш стек приезжает профильным бандлом (`dotnet-developer` или `ts-fullstack`); skills по стеку подгружаются по мере надобности.

### Skills

Памятки: активируются сами по ключевым словам в контексте либо загружаются агентом явно. Плагин называется `dex-skill-<имя>`.

<details>
<summary><b>Перечень skills по категориям</b></summary>

| Категория | Skills |
|-----------|--------|
| **Контракт и адресация артефактов** | `node-contract`, `docs-layout`, `project-docs-map`, `issue-tracking`, `artifact-naming`, `unit-identity`, `decision-log`, `stack-registry` |
| **Требования и продукт** | `idea-forming`, `opportunity-canvas`, `product-discovery`, `epic-planning`, `prioritization`, `user-stories`, `use-cases-cockburn`, `functional-requirements`, `nfr`, `business-analysis-29148`, `system-requirements-29148`, `doc-standards` |
| **Оракулы качества артефактов** | `requirement-quality`, `requirement-set-quality`, `use-case-quality`, `adr-quality`, `design-quality`, `plan-quality`, `api-spec-quality`, `completeness-mapping`, `fact-verification`, `legacy-reconstruction`, `verification-planning-29119`, `bdd-gherkin` |
| **Архитектура и дизайн** | `ddd`, `solid`, `scalability`, `architecture-definition-42010`, `interface-definition-openapi`, `implementation-plan` |
| **Ревью и дисциплина изменений** | `merge-conflict-resolution`, `review-evidence`, `review-step-by-step`, `review-threads`, `defect-classification`, `performance-review`, `post-merge-remediation`, `ci-gates`, `project-baseline`, `codebase-conventions`, `optimize-for-llm`, `norm-writing`, `artifact-review` |
| **Раздача работы исполнителям (экспериментально)** | `subagent-dispatch` |
| **QA и тестирование** | `api-testing`, `test-coverage`, `testability`, `integration-boundary`, `bug-reproduction`, `playwright`, `stand-verification` |
| **Инциденты и RCA** | `root-cause-analysis`, `change-correlation`, `shared-stand-safety`, `core-dumps`, `managed-debug`, `native-debug`, `perf-profiling`, `syscall-tracing`, `binary-inspection` |
| **.NET** | `dotnet-api-development`, `dotnet-async-patterns`, `dotnet-code-quality`, `dotnet-csproj-hygiene`, `dotnet-ef-core`, `dotnet-logging`, `dotnet-resilience`, `dotnet-testing-patterns`, `dotnet-validation`, `api-documentation` |
| **Frontend и TypeScript** | `react`, `ts-nodejs-api`, `ts-vitest-jest` |
| **Инфраструктура** | `kubernetes`, `rabbitmq`, `kafka`, `elasticsearch`, `redis`, `mongodb`, `gitlab-ci`, `github-actions`, `jenkins`, `teamcity`, `observability` |
| **ML и Python** | `python-pytorch`, `python-tensorflow`, `python-nlp-transformers`, `python-computer-vision`, `python-ml-optimization`, `python-project-hygiene` |

Перечень сверяется с `.claude-plugin/marketplace.json` прогоном `node tools/validate-readme.js` (входит в `npm run validate` и CI); генератора у таблицы нет. Skill, который едет внутри плагина-владельца (CLAUDE.md, «Структура плагина»), отдельной записи в каталоге не имеет и здесь не перечислен - его называет витрина владельца.

</details>

### Утилиты

<details>
<summary><b>CLI-утилиты</b> - gh, glab, kubectl, psql, redis-cli, kaf, rabbitmqadmin, aws s3, netcoredbg, playwright, jira</summary>

Тонкие слэш-команды над проверенными CLI. Все CLI-плагины одной командой: `./install-bundle/install-bundle.sh cli-tools`. Гайд (установка бинарей, настройка, CLI против MCP): [docs/CLI_UTILITIES.md](./docs/CLI_UTILITIES.md).

| Плагин | Группа | Описание | Бинарь |
|--------|--------|----------|--------|
| dex-github-cli | VCS и CI/CD | Workflow runs, PRs, Actions logs | `gh` |
| dex-gitlab-cli | VCS и CI/CD | Pipelines, MRs, job logs | `glab` |
| dex-jenkins-cli | VCS и CI/CD | Jobs, builds, console output | REST API |
| dex-teamcity-cli | VCS и CI/CD | Builds, agents, build logs | REST API |
| dex-jira-cli | Трекер | Issues, JQL search, sprints (read-only) | `jira` |
| dex-kubectl-cli | Инфраструктура и данные | Pods, logs, deployments, events, контексты | `kubectl` |
| dex-psql-cli | Инфраструктура и данные | Read-only запросы, схема, EXPLAIN, locks | `psql` |
| dex-redis-cli | Инфраструктура и данные | Server info, scan ключей, memory, monitor | `redis-cli` |
| dex-kaf-cli | Инфраструктура и данные | Topics, consumer groups, consume, produce | [`kaf`](https://github.com/birdayz/kaf) |
| dex-rabbitmqadmin-cli | Инфраструктура и данные | Overview, queues, bindings, publish | [`rabbitmqadmin-ng`](https://github.com/rabbitmq/rabbitmqadmin-ng) |
| dex-aws-s3-cli | Инфраструктура и данные | List, bucket info, head-object, presigned URL | `aws s3` / `s3api` |
| dex-netcoredbg-cli | Отладка | Attach и launch .NET-процесса, MI2 batch, дамп managed-стеков | [`netcoredbg`](https://github.com/Samsung/netcoredbg) |
| dex-playwright-cli | Браузерные тесты | Run tests, show HTML report, codegen, trace viewer, install браузеров | `npx playwright` |

Плагины ставят только команды, сами программы должны быть на машине. Скрипт проверяет и доставляет недостающие:

```bash
./install-bundle/install-cli-tools.sh --check   # что есть, чего не хватает
./install-bundle/install-cli-tools.sh --all     # поставить всё недостающее (apt / dnf / pacman / apk / brew, определяется само)
./install-bundle/install-cli-tools.sh psql redis-cli kaf rabbitmqadmin aws   # точечно
```

Windows: `install-bundle\install-cli-tools.ps1` (winget / scoop / choco).

</details>

<details>
<summary><b>Уведомления и анализ репозитория</b> - Telegram, Discord, MCP Inspector, сводка по кодовой базе</summary>

| Плагин | Команды | Описание |
|--------|---------|----------|
| dex-telegram-notifier | `/notify-config`, `/notify-test` | Telegram уведомления о событиях Claude Code |
| dex-discord-notifier | - | Discord уведомления о событиях Claude Code |
| dex-mcp-inspector | `/mcp-inspect` | MCP Inspector: тестирование и отладка MCP серверов |
| dex-codebase-analyzer | `/codebase-summary`, `/codebase-graph`, `/codebase-pack` | Обзор стека, граф зависимостей и упаковка репозитория для архитектурной сессии |
| dex-knowledge-extractor | `/mr-collect`, `/mr-analyze`, `/mr-apply` | Извлечение уроков из чужих MR в правки каталога. Для автора каталога: работает в клоне этого репозитория |

</details>

### Моды

Мод меняет сам Claude Code: это TypeScript-модуль (function hooks), который работает внутри процесса клиента и меняет то, что он делает и показывает. Моды ставятся адресно, в бандлы ролей не входят и требуют Claude Code 2.1.287 или новее. API модов в раннем доступе. Подробнее: [docs/MOD_FRAMEWORK.md](./docs/MOD_FRAMEWORK.md).

```bash
claude plugin install dex-github-pr-tracker@dex-claude-marketplace
claude plugin install dex-gitlab-mr-tracker@dex-claude-marketplace
claude plugin install dex-jira-tracker@dex-claude-marketplace
claude plugin install dex-session-dispatcher@dex-claude-marketplace
```

<details>
<summary><b>Что умеют моды</b> - трекеры PR/MR, трекер Jira и диспетчер сессий</summary>

| Мод | Команда | Описание |
|-----|---------|----------|
| dex-github-pr-tracker | `/pr` | Pull request текущей ветки без похода в браузер: состояние, исход обязательных проверок, вердикт ревью и апрувы, треды, коммиты - строкой над вводом и панелью; изменения приходят тостом. `/pr threads` и `/pr checks` отдают модели треды и упавшие проверки; `/pr list`, `/pr open`, `/pr week` следят за несколькими PR сразу; `/pr repo` нужен, когда сессия открыта не в клоне |
| dex-gitlab-mr-tracker | `/mr` | Merge request текущей ветки без похода в браузер: состояние, пайплайн, апрувы, треды, коммиты - строкой над вводом и панелью; изменения приходят тостом. `/mr threads` отдаёт модели треды; `/mr list` следит за несколькими MR сразу; `/mr repo` нужен, когда сессия открыта не в клоне |
| dex-jira-tracker | `/jira` | Задачи Jira без похода в браузер, через jira-cli: в работе, открытые, мои - строкой над вводом и панелью; смена статуса, исполнителя, новая задача и новый комментарий приходят тостом, а что случилось, пока сессия была закрыта, - одной сводкой. От задачи кнопками: постановка (`/feature` каталога либо встроенный шаблон), взять в работу (назначить, перевести, ветка, `/implement` либо встроенное поручение), сдать (push, PR/MR, ссылка в задачу), дальше PR/MR ведёт трекер хостинга. `/jira tools` показывает, что подхвачено из каталога и чем заменено остальное |
| dex-session-dispatcher | `/sessions` | Одно окно для всех сессий Claude Code на машине: кто работает, кто ждёт ответа, кто закончил; заполнение контекста, расход токенов, план и субагенты каждой. Сессию можно начать в фоне фразой-задачей, написать любой сессии, прочитать её вывод, остановить или удалить (опасные кнопки переспрашивают). Написан для новичка: слова вместо статусов и подсказка к каждому состоянию |

Два трекера PR/MR одной формы: строка, панель, общий список наблюдения, команды и настройки у них совпадают, различия идут от хостингов и названы в README каждого. Трекер Jira следит за задачами, а не за кодом, и передаёт работу командам каталога и этим трекерам; диспетчер сессий устроен отдельно.

</details>

### MCP-серверы

Готовые конфигурации MCP-серверов лежат в `mcp/` ([mcp/README.md](./mcp/README.md)), доступы - в [CREDENTIALS.md](./CREDENTIALS.md).

<details>
<summary><b>Какие MCP-серверы нужны какой роли</b></summary>

| Роль | Required | Optional |
|------|----------|----------|
| .NET Developer | gitlab | genai-toolbox, rabbitmq, kafka, docker, seq, kubernetes |
| Architect | github, gitlab | notion, filesystem |
| DevOps | gitlab | docker, kubernetes, sentry |
| Product Manager | notion | - |
| System Analyst | pdf-reader | notion, google-drive |
| QA Engineer | gitlab | filesystem |
| ML Engineer | gitlab | mlflow, wandb, huggingface |

</details>

## Как это устроено

Работа идёт сверху вниз: вы вызываете команду, она ведёт порядок шагов через специалистов, а специалисты опираются на skills.

```
Команда        /feature, /design, /implement, /mr-review   точка входа, ведёт порядок шагов
   |
Специалисты    агенты с узкой ролью                         делают шаги и возвращают результат
   |
Skills         памятки по стекам и темам                    подгружаются в нужный момент
```

Плагины ставятся порознь, поэтому набор под роль задаёт бандл. Мод стоит особняком: он меняет сам клиент.

<details>
<summary><b>Уровни каталога и состав плагина</b></summary>

| Уровень | Что | Из чего состоит | Имя |
|---------|-----|-----------------|-----|
| Level 3 | Bundles: наборы под роль | `bundle.json` (состав) и `README.md` | `dex-bundle-{role}` |
| Level 2 | Specialists: агенты с узкой ролью | `agents/<name>.md`, опционально `commands/<name>.md` | `dex-{domain}-{role}` или `dex-{name}-specialist` |
| Level 1 | Skills: базы знаний | `skills/<name>/SKILL.md` | `dex-skill-{name}` |
| Level 1 | Utilities: хуки, уведомления, CLI | `hooks/` и (или) `commands/` | `dex-{name}` |
| Сбоку | Mods: function hooks | `hooks/hooks.json` с ключом `modules`, TypeScript в `hooks/`; лежат в `mods/`, не в `plugins/` | `dex-{name}` |

У каждого плагина есть `.claude-plugin/plugin.json` (манифест). Команды лежат поверх уровней: команда живёт в плагине специалиста, которому делегирует.

- Skill - это ловушки и anti-patterns, а не документация API.
- Агент описывается фазами с контрактом (цель, выход, критерий завершения, гейт), а не набором процедур.
- Общие агенты не зашивают «если .NET, то такой-то skill»: стек определяется по манифесту проекта, профильные `dex-skill-{стек}-*` грузятся по реестру. Новый стек - это новые skills и строка реестра, агенты не правятся.
- Состав бандла хранится в `bundle.json`, не в `plugin.json`: Claude Code строго проверяет `plugin.json` и тихо ломает плагины с неизвестными полями.

Устройство каждого вида: [Agent](./docs/AGENT_FRAMEWORK.md), [Skill](./docs/SKILL_FRAMEWORK.md), [Command](./docs/COMMAND_FRAMEWORK.md), [Mod](./docs/MOD_FRAMEWORK.md).

</details>

<details>
<summary><b>Структура репозитория</b></summary>

```
claude-code-marketplace/
├── plugins/
│   ├── skills/                    # Level 1: базы знаний
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
│   ├── auto/                      # dex-auto: автономные треки
│   └── bundles/                   # Level 3: наборы
│       ├── dex-bundle-dotnet-developer/
│       └── ...
├── mods/                          # Моды: function hooks на TypeScript
│   ├── types/claude-code.d.ts     # контракт API (пишет движок)
│   ├── tsconfig.json              # типы хуков; tsconfig.tests.json - типы прогонов
│   ├── dex-github-pr-tracker/
│   ├── dex-gitlab-mr-tracker/
│   ├── dex-jira-tracker/
│   └── dex-session-dispatcher/
├── docs/                          # Фреймворки и нормативы
├── tests/                         # Фикстуры правил, прогоны, активация
├── tools/                         # Валидаторы, раннер правил, синхронизаторы
├── install-bundle/                # Скрипты установки и удаления
├── mcp/                           # Конфигурации MCP-серверов
├── run-claude/                    # Конфигурация запуска
├── setup/                         # Установщики Node.js и uv для MCP-серверов
├── adoption/                      # Playbook внедрения агентного SDLC
├── assets/                        # Баннеры README
├── .claude-plugin/
│   └── marketplace.json           # Каталог всех плагинов (description и version синхронизирует sync:marketplace)
├── CLAUDE.md
├── CREDENTIALS.md
└── README.md
```

</details>

<details>
<summary><b>Технологический стек</b> - под какие стеки заточены специалисты и skills</summary>

**`.NET`** - .NET 8.0+ (async/await + CancellationToken), Entity Framework Core, xUnit + Moq, RabbitMQ + MassTransit, Elasticsearch, Redis + StackExchange.Redis, Serilog + Seq, Docker, Kubernetes, GitLab CI.

**`TS/JS`** - TypeScript fullstack: Node.js/Bun backend (Express/Fastify/Hono), React frontend, Vitest/Jest для тестов.

**Python ML** - Python 3.10+, PyTorch, TensorFlow/Keras, scikit-learn, XGBoost, HuggingFace Transformers, MLflow, Weights & Biases, Optuna, ONNX, TFLite, FastAPI.

</details>

<details>
<summary><b>Требования и платформы</b> - что нужно на машине, Linux, macOS, Windows</summary>

- **Claude Code** - последняя версия
- **jq** - для install-скриптов на Linux/macOS
- **Credentials** - API-ключи для MCP-интеграций ([CREDENTIALS.md](./CREDENTIALS.md))

Под разные части каталога нужны разные инструменты:

| Что ставите | Linux | macOS |
|---|---|---|
| Плагины бандлов (`install-bundle.sh`) | `jq` + `claude` | `brew install jq` + `claude` |
| CLI-бинари (`install-cli-tools.sh`) | apt / dnf / pacman / apk (определяется само) | Homebrew (`brew`) |
| npx-MCP и `dex-playwright-cli` | Node.js (`setup/npx-install/install.sh`) | Node.js (`brew install node`) |
| uvx-MCP (gitlab, rabbitmq, docker, mlflow) | uv (`setup/uvx-install/install.sh`) | тот же скрипт (uv ставит свой установщик, brew не нужен) |
| Нотификаторы (telegram / discord) | `jq` + `curl` | `jq` + `curl` (в составе macOS) |

- **Linux** - основной путь. Bash-скриптам нужен один из пакетных менеджеров (apt / dnf / pacman / apk).
- **macOS** - поддержан, Intel и Apple Silicon. Скрипты работают на стоковом `/bin/bash` 3.2, отдельный bash через Homebrew не нужен; CLI-бинари ставятся через Homebrew. Часть низкоуровневых утилит ограничена платформой: `netcoredbg` и `valgrind` не собираются под Apple Silicon (arm64), а `strace`, `bpftrace`, `bcc` и `perf` есть только на Linux. Матрица по CLI-утилитам - [docs/CLI_UTILITIES.md](./docs/CLI_UTILITIES.md), по MCP-серверам - [mcp/README.md](./mcp/README.md).
- **Windows** - через PowerShell-скрипты (`*.ps1`) или WSL.

</details>

## Участие

Хотите добавить плагин или поправить существующий? Начните с [CLAUDE.md](./CLAUDE.md): там правила разработки каталога.

Пользовательская документация с примерами и каталогом плагинов - [сайт](https://dex-it.github.io/claude-code-marketplace/); его страницы лежат в [docs/guide/](./docs/guide/), проект сайта - в [site/](./site/).

1. Форкните репозиторий и создайте ветку от `develop`.
2. Прочитайте устройство артефакта, который правите ([Agent](./docs/AGENT_FRAMEWORK.md), [Skill](./docs/SKILL_FRAMEWORK.md), [Command](./docs/COMMAND_FRAMEWORK.md), [Mod](./docs/MOD_FRAMEWORK.md)).
3. Прогоните проверки и откройте Pull Request в `develop`.

<details>
<summary><b>Для контрибьюторов</b> - правила правок, версии, проверки перед коммитом</summary>

**Правила.** Нормативные тексты лежат рядом с кодом:

- [CLAUDE.md](./CLAUDE.md) - как писать плагины, ревьюить и проверять перед коммитом;
- [.claude/rules/plugin-changes.md](./.claude/rules/plugin-changes.md) - версии (semver), обязательные синхронизации, гейт перед коммитом;
- [.claude/rules/docs-changes.md](./.claude/rules/docs-changes.md) - правки документации;
- [.claude/rules/terminology.md](./.claude/rules/terminology.md) - заведённые имена; значения - в [словаре](./docs/domain/domain-model.md).

**Что обязательно при правках каталога:**

- новый или переименованный плагин - запись в `.claude-plugin/marketplace.json` и строка в этом README (иначе упадёт проверка);
- версия плагина меняется в `plugin.json` и в `marketplace.json` одновременно;
- версия самого каталога в `marketplace.json` и в подвале этого README совпадает;
- снятый или переименованный плагин - строка в `Renamed and removed plugins` файла [install-bundle/README.md](./install-bundle/README.md).

**Проверки** (нужен Node.js 22.6 или новее и `npm install`):

| Команда | Что проверяет |
|---------|---------------|
| `npm run validate` | Все валидаторы подряд: агенты, skills, команды, бандлы, витрина этого README, словарь имён, типы модов. Должно быть 0 ошибок |
| `npm test` | Сами правила валидаторов на фикстурах с заведомым дефектом |
| `npm run test:tools` | Тесты инструментов в `tests/tools/` |
| `npm run sync:marketplace -- --check` | Расхождения `description` и `version` между `plugin.json` и `marketplace.json`, без записи |
| `npm run test:mods` | Тесты модов |
| `npm run test:hooks`, `npm run test:tracks` | Хуки и треки `dex-auto` |

Правила валидаторов: [docs/VALIDATOR_RULES.md](./docs/VALIDATOR_RULES.md), [tools/README.md](./tools/README.md). Прогоны и фикстуры: [tests/README.md](./tests/README.md).

</details>

<details>
<summary><b>Документация каталога</b> - фреймворки, реестр правил, корпус, стандарты</summary>

Эти документы лежат в `docs/`. В установленный плагин они не входят: это правила для авторов, не рантайм.

| Документ | О чём |
|----------|-------|
| [AGENT_FRAMEWORK.md](./docs/AGENT_FRAMEWORK.md) | как устроен агент: фаза-контракт, стандартный вход и выход, рецепты ролей, frontmatter |
| [SKILL_FRAMEWORK.md](./docs/SKILL_FRAMEWORK.md) | как устроен skill: жанры, поле активации, границы, размер |
| [COMMAND_FRAMEWORK.md](./docs/COMMAND_FRAMEWORK.md) | как устроена команда-вход и чем она отличается от агента |
| [MOD_FRAMEWORK.md](./docs/MOD_FRAMEWORK.md) | как устроен мод: function hooks, дерево `mods/`, `userConfig`, контракт типов, инструментарий |
| [EXTENSION_MECHANISMS.md](./docs/EXTENSION_MECHANISMS.md) | справка: command hook, мод и Agent SDK - возможности рядом, когда что выбирать |
| [VALIDATOR_RULES.md](./docs/VALIDATOR_RULES.md) | реестр правил валидаторов: что ловит каждое и где живёт его норма |
| [CORPUS.md](./docs/CORPUS.md) | корпус проекта на диске: носители, уровни артефакта, ключи путей, кто судит |
| [DEV_PROCESS_COVERAGE.md](./docs/DEV_PROCESS_COVERAGE.md) | карта «слот процесса разработки -> агент, который его закрывает» |
| [standards/](./docs/standards/) | реестр внешних стандартов (ISO/IEEE/ГОСТ) со статусом сверки каждого факта |
| [pipelines/](./docs/pipelines/) | дизайн конвейера требований: нормы этапов, порядок работ, реализация |
| [CLI_UTILITIES.md](./docs/CLI_UTILITIES.md) | установка CLI-бинарей, конфигурация, CLI против MCP |

Уровень продукта: [ценность и цели (BRD)](./docs/product/brd.md), [словарь](./docs/domain/domain-model.md), [конституция](./docs/domain/constitution.md).

</details>

## Лицензия

GPL v3.0, см. [LICENSE](./LICENSE).

---

**DEX Team** - Version 6.27.0
