# MR Analyze: dex/service-x !100

## Proposed new skills

### dex-skill-dotnet-feature-flags

**Описание:** .NET feature flags — Microsoft.FeatureManagement, ловушки conditional logic. Активируется при feature flag, IFeatureManager, IsEnabledAsync, A/B test, gradual rollout, dark launch, feature toggle, AddFeatureManagement, FilterAlias, FeatureGate, TimeWindow filter, percentage filter, targeting filter.

**Содержимое SKILL.md:**

```markdown
---
name: dotnet-feature-flags
description: .NET feature flags — Microsoft.FeatureManagement, ловушки conditional logic. Активируется при feature flag, IFeatureManager, IsEnabledAsync, A/B test, gradual rollout, dark launch, feature toggle, AddFeatureManagement, FilterAlias, FeatureGate, TimeWindow filter, percentage filter, targeting filter.
---

# .NET Feature Flags

## Conditional logic под флагом

### Длинный if под флагом

**Плохо:** двести строк новой и двести строк старой логики в одной функции под `if (await _features.IsEnabledAsync("X"))`.

**Правильно:** каждая ветка — отдельный класс через стратегию, регистрация по флагу в DI. Старую ветку удалить через 2 спринта после rollout.

**Почему:** длинные if под флагом превращаются в спагетти, обе ветки дрейфуют независимо, удалить старую страшно. Стратегия + DI делает удаление одной строкой.

### IsEnabledAsync в hot path без кэша

**Плохо:** вызов `IFeatureManager.IsEnabledAsync` на каждый запрос в горячем коде без кэширования провайдера.

**Правильно:** `AddFeatureManagement().AddSessionManager<...>` или `AddFeatureFilter` с TTL-кэшем; для per-request — `IFeatureManagerSnapshot`.

**Почему:** дефолтный provider читает конфигурацию каждый вызов. На 10k RPS это лишняя нагрузка на ConfigurationProvider и аллокации в hot path.

## Filter'ы и таргетинг

### TargetingFilter без targeting context

**Плохо:** `<Filter Name="Targeting">` без зарегистрированного `ITargetingContextAccessor` — флаг всегда `false`, никто не замечает.

**Правильно:** `AddSingleton<ITargetingContextAccessor, MyAccessor>()` + проверка интеграционным тестом, что `IsEnabledAsync("X")` возвращает true для нужного user-id.

**Почему:** при отсутствии accessor библиотека не падает, тихо считает целевую аудиторию пустой. Дефолтное поведение = «выключено для всех» без сигнала об ошибке.

### PercentageFilter с нестабильным ключом

**Плохо:** `PercentageFilter` с дефолтным контекстом, где для одного и того же пользователя процент попадания меняется между запросами.

**Правильно:** `ContextualFeatureFilter<TContext>` с явным стабильным ключом (`UserId`, `TenantId`), не зависящим от времени запроса.

**Почему:** дефолт берёт случайное число на запрос, не привязываясь к пользователю. Один и тот же user видит фичу включённой/выключенной случайно — A/B тест бесполезен.

## Удаление флага

### Флаг без даты удаления

**Плохо:** флаг живёт в `appsettings.json` бессрочно, после полного rollout никто не помнит, что под ним.

**Правильно:** запись в трекере с датой удаления, TODO в коде с тикет-ссылкой, dashboard «флаги старше N дней».

**Почему:** мёртвые флаги — основной источник долга feature management. Через год флагов больше, чем фич, никто не знает, какие безопасно удалить.
```

## Proposed skill additions

(пусто)

## Proposed agent changes

(пусто)
