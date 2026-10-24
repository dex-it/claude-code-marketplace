---
name: teamcity
description: TeamCity - Kotlin DSL и шаги dotnet в цепочке сборок. Активируется при teamcity, build configuration, build chain, Kotlin DSL, settings.kts, snapshot dependency, versioned settings, dotnet restore, no-build, no-restore, шаги сборки
---

# TeamCity - чек-лист

Пункт называет ситуацию, которую конфигурация проверяет.

- Шаги `dotnet` одной конфигурации заново делают restore и build
- Конфигурация только в UI, без Kotlin DSL в репозитории
