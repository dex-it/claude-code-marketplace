# MR Analyze: dex/service-mixed !777

## Proposed skill additions

### dex-skill-dotnet-async-patterns: ConfigureAwait(false) в библиотечном коде

**Целевой skill:** dex-skill-dotnet-async-patterns
**H2-секция:** ConfigureAwait и SynchronizationContext

**Critical assessment:**
- Generalization confidence: high -- правило про ConfigureAwait в библиотечном коде не зависит от конкретного проекта
- Systemic vs incidental: systemic
- False positive risk: low -- закрыто оговоркой «для Web API без разницы»
- FP counter-examples: код приложения ASP.NET Core (нет SyncContext -- ConfigureAwait не нужен) -- правило адресует именно библиотечный/NuGet код, не приложение; ложного осуждения нет
- Already covered elsewhere: no
- Non-obviousness: high -- «ASP.NET Core не имеет SyncContext, поэтому в Web API разницы нет» -- неочевидное следствие, отделяющее ловушку от лозунга «всегда ConfigureAwait(false)»
- Axis fit: dex-skill-dotnet-async-patterns (ConfigureAwait и SynchronizationContext) -- ложится в существующий H2
- Label correctness: n/a -- концептуального ярлыка нет
- Fact check: verified (websearch) -- отсутствие SynchronizationContext в ASP.NET Core и поведение захвата контекста сверены

Recommendation for reviewer: apply as-is

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

**Critical assessment:**
- Generalization confidence: high -- streaming vs материализация больших выборок -- общая граблина EF Core, не проектная
- Systemic vs incidental: systemic
- False positive risk: low
- FP counter-examples: малые выборки, где `ToListAsync` нужен для повторного перебора / Count -- правило адресует «миллионы строк, построчная обработка», не любой `ToListAsync`; формулировка сужена кейсом
- Already covered elsewhere: no
- Non-obviousness: high -- что `AsAsyncEnumerable` стримит через DataReader при константной памяти, а `ToListAsync` грузит всё -- неочевидно начинающему
- Axis fit: dex-skill-dotnet-ef-core (Запросы) -- ложится в существующий H2
- Label correctness: n/a
- Fact check: verified (context7:EFCore) -- поведение `AsAsyncEnumerable` (стриминг через DataReader) и материализация `ToListAsync` сверены по доке EF Core

Recommendation for reviewer: apply as-is

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

### dex-mr-reviewer: добавить проверку breaking changes в DTO/контрактах

**Целевой агент:** dex-mr-reviewer
**Фаза:** Content-Level Pass

**Critical assessment:**
- Generalization confidence: high -- breaking change в публичном контракте -- класс, не частный случай этого MR
- Systemic vs incidental: systemic -- ревьюер систематически не имеет пункта про контрактные ломки, это gap в workflow, не «в этом MR пропустили»
- False positive risk: low -- проверка адресует только публичные DTO / API contract, не внутренние модели
- FP counter-examples: добавление nullable-поля с дефолтом (backward-compatible) -- пункт требует «пометить как breaking», но формулировка про изменение/удаление и смену required/optional, чистое добавление под неё не подпадает
- Already covered elsewhere: no -- среди фаз mr-reviewer нет контрактного diff-чек-листа
- Non-obviousness: high -- «структурная правка модели в diff не отличима от breaking change контракта без спец-проверки» -- неочевидный gap
- Axis fit: dex-mr-reviewer (Content-Level Pass) -- содержательная проверка изменений, ложится в фазу
- Label correctness: n/a
- Fact check: n/a -- организационная правка workflow агента, фактов об API не содержит

Recommendation for reviewer: apply as-is

**Изменение:** в чек-лист фазы Content-Level Pass (Phase 5) добавить пункт «для каждого изменённого/удалённого поля в публичных DTO / API response / контрактах — пометить как breaking change, требующий versioning или миграционного плана. Сюда же — изменение поля required/optional, типа поля, default value».

**Почему:** ревьюер пропускает контрактные ломки между сервисами (`UserDto.Email` стал nullable → потребитель упал на десериализации). Структурные правки видны в diff, но без специальной проверки воспринимаются как «обычная правка модели».

## Skipped (already covered)

### dex-skill-dotnet-async-patterns: CancellationToken во всех async API

Уже описано в текущем skill, секция "CancellationToken propagation".

## Dropped (not actionable)

### Общая придирка к стилю именования переменных

Не обобщается в правило, субъективно.
