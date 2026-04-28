# MR Analyze: dex/service-x !100

## Proposed new skills

### dex-skill-dotnet-feature-flags

**Описание:** .NET feature flags — Microsoft.FeatureManagement, ловушки conditional logic. Активируется при feature flag, IFeatureManager, IsEnabledAsync, A/B test, gradual rollout, dark launch.

**Содержимое SKILL.md:**

```markdown
---
name: dotnet-feature-flags
description: .NET feature flags — Microsoft.FeatureManagement, ловушки conditional logic. Активируется при feature flag, IFeatureManager, IsEnabledAsync, A/B test, gradual rollout, dark launch.
---

# .NET Feature Flags

## Conditional logic с IFeatureManager

**Плохо:**

```csharp
if (await _features.IsEnabledAsync("NewCheckout"))
{
    // 200 строк новой логики
}
else
{
    // 200 строк старой логики
}
```

**Правильно:** Вынести каждую ветку в отдельный класс через стратегию + регистрацию по feature flag в DI. Удалять старую ветку через 2 спринта после полного rollout.

**Почему:** Длинные if под флагом превращаются в нечитаемое спагетти, обе ветки дрейфуют независимо, удалить старую страшно. Стратегия + DI делает удаление одной строкой.
```

## Proposed skill additions

(пусто)

## Proposed agent changes

(пусто)
