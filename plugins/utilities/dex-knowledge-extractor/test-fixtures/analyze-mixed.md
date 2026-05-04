# MR Analyze: dex/service-mixed !777

## Proposed skill additions

### dex-skill-dotnet-async-patterns: ConfigureAwait(false) в библиотечном коде

**Целевой skill:** dex-skill-dotnet-async-patterns
**H2-секция:** ConfigureAwait и SynchronizationContext

**Drop-in:**

### ConfigureAwait(false) в библиотечном коде

**Плохо:**

```csharp
public async Task<Result> ProcessAsync()
{
    var data = await _client.GetAsync("/api/data");
    return Parse(data);
}
```

**Правильно:**

```csharp
public async Task<Result> ProcessAsync()
{
    var data = await _client.GetAsync("/api/data").ConfigureAwait(false);
    return Parse(data);
}
```

**Почему:** В библиотечном коде, не зависящем от UI/SynchronizationContext, отсутствие ConfigureAwait(false) приводит к захвату контекста и потенциальным дедлокам в callers с UI-контекстом. Для Web API (ASP.NET Core) — без разницы (нет SyncContext), но привычка полезна для NuGet-библиотек.

### dex-skill-dotnet-ef-core: AsAsyncEnumerable для streaming больших выборок

**Целевой skill:** dex-skill-dotnet-ef-core
**H2-секция:** Запросы

**Drop-in:**

### AsAsyncEnumerable для streaming больших выборок

**Плохо:**

```csharp
var items = await _ctx.Logs.Where(l => l.Date > since).ToListAsync();
foreach (var item in items) await _processor.HandleAsync(item);
```

**Правильно:**

```csharp
await foreach (var item in _ctx.Logs.Where(l => l.Date > since).AsAsyncEnumerable())
    await _processor.HandleAsync(item);
```

**Почему:** `ToListAsync` материализует всю выборку в память (миллионы строк → OOM). `AsAsyncEnumerable` стримит по строкам через DataReader — память константна. Подходит, когда обработка построчная и не нужно держать всё сразу.

## Proposed agent changes

### dex-dotnet-reviewer: добавить проверку breaking changes в DTO/контрактах

**Целевой агент:** dex-dotnet-reviewer
**Фаза:** Content-Level Pass

**Изменение:** в чек-лист Phase 4 добавить пункт «для каждого изменённого/удалённого поля в публичных DTO / API response / контрактах — пометить как breaking change, требующий versioning или миграционного плана. Сюда же — изменение поля required/optional, типа поля, default value».

**Почему:** ревьюер пропускает контрактные ломки между сервисами (`UserDto.Email` стал nullable → потребитель упал на десериализации). Структурные правки видны в diff, но без специальной проверки воспринимаются как «обычная правка модели».

## Skipped (already covered)

### dex-skill-dotnet-async-patterns: CancellationToken во всех async API

Уже описано в текущем skill, секция "CancellationToken propagation".

## Dropped (not actionable)

### Общая придирка к стилю именования переменных

Не обобщается в правило, субъективно.
