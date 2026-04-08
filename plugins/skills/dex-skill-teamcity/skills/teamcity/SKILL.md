---
name: teamcity
description: TeamCity CI/CD — ловушки build chains, DSL, артефактов. Активируется при teamcity, build configuration, meta-runner, artifact, build chain, Kotlin DSL, snapshot dependency, failure conditions, build template, password parameter, trigger chain, artifact dependency
---

# TeamCity — ловушки и anti-patterns

## Build Chain

### Trigger chain вместо snapshot dependency
Плохо: Build -> (finish trigger) -> Test -> (finish trigger) -> Deploy — цепочка через триггеры
Правильно: `snapshot(Build) { onDependencyFailure = FailureAction.FAIL_TO_START }` — snapshot dependency
Почему: trigger chain не гарантирует один source revision. Если Build запустился 2 раза, Test может взять артефакты от другого Build

### Все шаги в одной Build Configuration
Плохо: restore + build + test + publish + deploy = один конфиг
Правильно: Build Chain: Build -> (Unit Tests || Integ Tests || E2E Tests) -> Publish -> Deploy
Почему: нельзя перезапустить только deploy, нельзя параллелить тесты, один упавший шаг блокирует весь pipeline

### Artifact dependency от latest successful
Плохо: `buildRule = lastSuccessful()` — может взять артефакт от другой ветки
Правильно: `buildRule = sameChainOrLastFinished()` + snapshot dependency на тот же Build
Почему: latest successful = из любой ветки. Deploy может выкатить артефакт от feature branch вместо main

## Kotlin DSL

### Копипаста шагов между конфигурациями
Плохо: одинаковые restore -> build -> test шаги в 10 проектах — 10 мест для правки
Правильно: `Template` с параметрами: `text("solution.path", "", display = ParameterDisplay.PROMPT)`
Почему: одно изменение в template применяется ко всем проектам. Без template — ручная синхронизация 10 конфигов

### UI-only конфигурация в production
Плохо: все настройки через UI — нет версионирования, нет code review, нет отката
Правильно: Kotlin DSL в репозитории — Git, PR review, `git revert` для отката
Почему: UI изменения не отслеживаются. При ошибке — откат вручную по памяти. Нет аудита кто и что изменил

## Безопасность

### Секреты в plain text параметрах
Плохо: `text("db.password", "P@ssw0rd!")` — видно всем, логируется в build log
Правильно: `password("db.password", "", display = ParameterDisplay.HIDDEN)`
Почему: plain text параметры видны в UI, экспортируются через REST API, не маскируются в логах. Password type маскирует везде

## Failure Conditions

### Нет failure conditions — ложно-зеленый билд
Плохо: `OutOfMemoryException` в логе, но exit code 0 — TeamCity считает успехом
Правильно: `failureConditions { failOnText { pattern = "OutOfMemoryException" }; executionTimeoutMin = 60 }`
Почему: не все ошибки дают non-zero exit code. Без явных conditions — билд "зеленый" при реальных проблемах

### Нет metric failure condition
Плохо: тесты не запустились (0 тестов), но билд зеленый — все 0 тестов прошли
Правильно: `failOnMetricChange { metric = TEST_COUNT; threshold = 0; comparison = LESS }`
Почему: 0 тестов = что-то сломалось в test discovery. Без metric condition — silent failure

## Оптимизация

### Повторная работа между шагами
Плохо: `dotnet restore` + `dotnet build` + `dotnet test` — каждый шаг заново делает restore/build
Правильно: `dotnet build` (включает restore) + `dotnet test --no-build` + `dotnet publish --no-build`
Почему: `--no-restore`/`--no-build` пропускает уже сделанную работу. Без флагов — двойная/тройная компиляция

## Чек-лист

- Kotlin DSL в репозитории (не только UI)
- Templates для повторяющихся конфигураций
- Snapshot dependencies в Build Chain (не trigger chains)
- Artifact dependency = sameChainOrLastFinished
- Секреты = password type parameters
- Failure conditions настроены (text, timeout, metric)
- `--no-restore` / `--no-build` между шагами
- Параллельные тесты в отдельных Build Configurations
