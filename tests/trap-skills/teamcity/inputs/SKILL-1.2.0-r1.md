---
name: teamcity
description: TeamCity - Kotlin DSL и шаги dotnet в цепочке сборок. Активируется при teamcity, build configuration, build chain, Kotlin DSL, settings.kts, snapshot dependency, versioned settings, dotnet restore, no-build, no-restore, шаги сборки
---

# TeamCity - чек-лист

Пункт называет ситуацию, которую конфигурация проверяет.

- Шаги `dotnet` без `--no-restore` и `--no-build` между шагами цепочки
- Конфигурация только в UI, без Kotlin DSL в репозитории
