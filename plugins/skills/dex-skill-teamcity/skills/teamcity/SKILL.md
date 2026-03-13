---
name: teamcity-patterns
description: TeamCity CI/CD — ловушки, build chains, Kotlin DSL. Активируется при teamcity, build configuration, meta-runner, artifact, build chain
allowed-tools: Read, Grep, Glob
---

# TeamCity Patterns — ловушки

## Правила

- Kotlin DSL для версионирования конфигураций (не UI-only)
- Build Templates для переиспользования (не копируй configs)
- Snapshot dependencies для Build Chains (не trigger chains)
- Секреты — password type parameters, не plain text
- `--no-restore` / `--no-build` между шагами (не повторяй работу)
- Failure conditions — настрой явно, не полагайся на exit code

## Анти-паттерны

```kotlin
// Плохо — trigger chain вместо snapshot dependency
// Build → (finish trigger) → Test → (finish trigger) → Deploy
// Если Build запустился 2 раза, Test может взять артефакты от другого Build!

// Хорошо — snapshot dependency (гарантирует один и тот же source revision)
object Test : BuildType({
    dependencies {
        snapshot(Build) {
            onDependencyFailure = FailureAction.FAIL_TO_START // не запускай тест если билд упал
        }
    }
})

// Плохо — копипаста шагов restore → build → test в каждой конфигурации
// 10 проектов × одинаковые шаги = 10 мест для правки при изменении

// Хорошо — Template + параметризация
object DotNetTemplate : Template({
    params {
        text("solution.path", "", display = ParameterDisplay.PROMPT, label = "Solution path")
        select("configuration", "Release", options = listOf("Debug", "Release"))
    }
    steps {
        dotnetBuild {
            projects = "%solution.path%"
            configuration = "%configuration%"
        }
    }
})
// Проекты наследуют: templates(DotNetTemplate) { param("solution.path", "src/MyApp.sln") }

// Плохо — все шаги в одной Build Configuration
// restore + build + test + publish + deploy = один конфиг
// Нельзя перезапустить только deploy, нельзя параллелить тесты

// Хорошо — раздели на Build Chain
//          ┌─ Unit Tests ────┐
// Build ───┼─ Integ Tests ───┼── Publish → Deploy
//          └─ E2E Tests ─────┘
// Параллельные тесты, можно перезапустить любой шаг

// Плохо — секреты в plain text параметрах
params {
    text("db.password", "P@ssw0rd!")  // видно всем, логируется
}

// Хорошо — password type
params {
    password("db.password", "", display = ParameterDisplay.HIDDEN)
}
// Маскируется в логах, не экспортируется в REST API

// Плохо — нет failure conditions → билд "зелёный" при утечке памяти
// OutOfMemoryException в логе, но exit code 0 → TeamCity считает успехом

// Хорошо — явные failure conditions
failureConditions {
    failOnText {
        conditionType = BuildFailureOnText.ConditionType.CONTAINS
        pattern = "OutOfMemoryException"
    }
    executionTimeoutMin = 60  // не висеть часами
    failOnMetricChange {
        metric = BuildFailureOnMetric.MetricType.TEST_COUNT
        threshold = 0
        units = BuildFailureOnMetric.MetricUnit.DEFAULT_UNIT
        comparison = BuildFailureOnMetric.MetricComparison.LESS
        compareTo = value()
    }  // 0 тестов = что-то сломалось
}
```

## UI vs Kotlin DSL

| Критерий | UI | Kotlin DSL |
|----------|-----|------------|
| Быстрый старт | Да | Нет |
| Версионирование | Нет (только export) | Git, code review |
| Рефакторинг | Руками в каждом проекте | Одно изменение в template |
| Откат | Нет | git revert |
| Code review | Нет | PR как код |

**Правило:** начинай в UI для прототипа, переходи на Kotlin DSL для production.

## Artifact Dependencies — ловушка

```kotlin
// Плохо — latest successful build (может взять артефакт от другой ветки!)
dependencies {
    artifacts(Build) {
        buildRule = lastSuccessful()  // latest = из любой ветки
        artifactRules = "MyApp-*.zip!** => artifacts"
    }
}

// Хорошо — same chain (snapshot dependency гарантирует тот же revision)
dependencies {
    snapshot(Build) {}
    artifacts(Build) {
        buildRule = sameChainOrLastFinished()
        artifactRules = "MyApp-*.zip!** => artifacts"
    }
}
```

## Чек-лист

- [ ] Kotlin DSL в репозитории (не только UI)
- [ ] Templates для повторяющихся конфигураций
- [ ] Snapshot dependencies в Build Chain (не trigger chains)
- [ ] Artifact dependency = sameChainOrLastFinished
- [ ] Секреты = password type parameters
- [ ] Failure conditions настроены (text, timeout, metric)
- [ ] `--no-restore` / `--no-build` между шагами
- [ ] Параллельные тесты в отдельных Build Configurations
