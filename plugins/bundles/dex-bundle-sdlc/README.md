# dex-bundle-sdlc

Набор полного жизненного цикла разработки: идея -> требования -> дизайн -> код -> ревью -> стенд. Языко-агностично. Одна установка закрывает конвейер целиком, включая движок автономного доведения задачи до конца.

## Конвейер

- Движок: `dex-skill-autonomous-task` ведёт цель до конца сам и делегирует узлам-агентам по контракту `dex-skill-node-contract`. Треки - разработка, тест-инжиниринг, ревью MR, разбор ревью своего MR, приёмка на стенде, диагностика, документирование. Хук `dex-autonomous-task-resume` возвращает движок в процедуру возобновления после компакта контекста
- Требования: `dex-requirements-orchestrator` (`/feature`) ведёт идею через BRD (`dex-business-analyst`) и stories (`dex-user-story-analyst`) с гейтами качества; `dex-requirements-analyst` детализирует под инкремент, `dex-requirements-reviewer` (`/review-requirements`) судит готовый набор
- Дизайн: `dex-architect` (`/design`) проектирует по бизнес-задаче, `dex-adr-writer` (`/adr`) фиксирует решение, `dex-api-designer` - контракт, `dex-diagram-creator` - диаграммы, `dex-design-reviewer` (`/review-design`) согласует чужой дизайн до кода
- Реализация: `dex-feature-implementer` (`/implement`) доводит фичу по ТЗ до локальных коммитов; `dex-conflict-resolver` (`/resolve-conflicts`) подтягивает базовую ветку
- Тесты: `dex-test-analyst` разбирает требования в тест-кейсы, `dex-test-automator` автоматизирует
- Ревью: `dex-self-reviewer` (`/self-review`) перед push, `dex-mr-reviewer` (`/mr-review`) и `dex-mr-check-reviewer` (`/mr-check-review`) - чужой MR и его дельта, `dex-review-planner` (`/review-plan`) - разбор замечаний на своём MR, `dex-security-reviewer` (`/security-scan`) - отдельный проход по цепочкам эксплойтов
- Стенд и баги: `dex-stand-reviewer` (`/review-stand`) принимает слитую фичу, `dex-bug-finder` (`/find-bugs`) ищет дефекты, `dex-bug-reporter` оформляет, `dex-incident-investigator` (`/investigate`) и `dex-debugger` (`/root-cause`) ведут RCA, `dex-bug-fixer` закрывает пачку находок
- Вход в проект: `dex-codebase-analyzer` даёт обзор репозитория, `dex-code-discovery` (`/discover`) - инвентаризацию проблем вширь
- Документирование: `dex-doc-writer` пишет спеки, гайды, release notes; `dex-process-modeler` - BPMN

## Состав

Движок: `dex-skill-autonomous-task`, `dex-autonomous-task-resume`, `dex-skill-node-contract`, `dex-skill-project-docs-map`.

Специалисты требований и дизайна: `dex-requirements-orchestrator`, `dex-business-analyst`, `dex-requirements-analyst`, `dex-user-story-analyst`, `dex-requirements-reviewer`, `dex-process-modeler`, `dex-architect`, `dex-adr-writer`, `dex-api-designer`, `dex-diagram-creator`, `dex-design-reviewer`.

Специалисты кода и приёмки: `dex-feature-implementer`, `dex-conflict-resolver`, `dex-self-reviewer`, `dex-mr-reviewer`, `dex-mr-check-reviewer`, `dex-review-planner`, `dex-security-reviewer`, `dex-stand-reviewer`, `dex-bug-finder`, `dex-bug-reporter`, `dex-bug-fixer`, `dex-incident-investigator`, `dex-debugger`, `dex-test-analyst`, `dex-test-automator`, `dex-doc-writer`, `dex-code-discovery`, `dex-codebase-analyzer`.

Skills дисциплины (51): требования и продукт - `requirement-quality`, `requirement-set-quality`, `user-stories`, `agile`, `bpmn`, `product-discovery`, `nfr`; архитектура - `clean-architecture`, `ddd`, `solid`, `microservices`, `distributed-resilience`, `scalability`, `capacity-planning`, `cap-consistency`, `reference-architectures`, `tech-evaluation`, `adr-quality`, `api-specification`, `api-documentation`; ревью - `review-evidence`, `fact-verification`, `review-threads`, `review-step-by-step`, `artifact-review`, `completeness-mapping`, `no-loose-ends`, `performance-review`, `owasp-security`; диагностика и стенд - `problem-specification`, `root-cause-analysis`, `change-correlation`, `bug-reproduction`, `contract-drift`, `shared-stand-safety`, `stand-verification`, `post-merge-remediation`, `observability`; тесты - `test-design`, `test-coverage`, `testability`, `exploratory-testing`, `api-testing`; процесс и текст - `git-workflow`, `merge-conflict-resolution`, `codebase-conventions`, `stack-registry`, `doc-standards`, `output-hygiene`, `karpathy-guidelines`, `legacy-reconstruction`.

CLI трекера, MR-хостинга, CI и стенда: `dex-github-cli`, `dex-gitlab-cli`, `dex-jira-cli`, `dex-teamcity-cli`, `dex-kubectl-cli`.

## Что не входит и почему

- **Стек-специфичные узлы** (`dex-dotnet-coder`, `dex-ts-fullstack-coder`, `dex-dotnet-tester`, `dex-ts-tester`, `dex-ef-specialist`, `dex-architect-dotnet`) и профильные skills `dex-skill-{dotnet,ts,react}-*`. Бандл языко-агностичен: стек определяется по манифестам проекта, профильные skills грузятся условно по реестру `dex-skill-stack-registry`. Новый стек = новые `dex-skill-{стек}-*` плюс строка реестра, состав бандла не меняется. **Следствие:** без второго бандла под стек (`dotnet-developer`, `ts-fullstack`) движок на шаге «написать код» уходит в фоллбэк `general-purpose` - ставьте профильный бандл рядом.
- **Продуктовое управление** (`dex-backlog-manager`, `dex-roadmap-planner`, `dex-pm-metrics-analyst`) - это управление продуктом, а не конвейер SDLC. Дом - `dex-bundle-product-manager`.
- **Инфраструктурные специалисты** (`dex-postgresql-specialist`, `dex-redis-specialist`, `dex-elasticsearch-specialist`, `dex-docker-specialist`, `dex-cicd-gitlab`) - дом `dex-bundle-infrastructure` и `dex-bundle-devops`.
- **Нотификаторы** (`dex-telegram-notifier`, `dex-discord-notifier`) - требуют внешней настройки (токены, chat id), ставятся отдельно по необходимости.

## Установка

```bash
./install-bundle/install-bundle.sh sdlc
```

Предпросмотр без установки: `./install-bundle/install-bundle.sh sdlc --dry-run`.

Рядом со стеком:

```bash
./install-bundle/install-bundle.sh sdlc
./install-bundle/install-bundle.sh dotnet-developer
```
