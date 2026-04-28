# MR Analyze: dex/service-mixed !777

## Proposed skill additions

### dex-skill-dotnet-async-patterns: ConfigureAwait(false) в библиотечном коде

**Целевой skill:** dex-skill-dotnet-async-patterns
**H2-секция:** ConfigureAwait и SynchronizationContext

**Drop-in:**

#### ConfigureAwait(false) в библиотечном коде

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

### dex-skill-dotnet-linq-optimization: HashSet вместо Contains на List

**Целевой skill:** dex-skill-dotnet-linq-optimization
**H2-секция:** Коллекции и поиск

**Drop-in:**

#### HashSet вместо Contains на List

**Плохо:**

```csharp
var ids = new List<int> { 1, 2, 3, ..., 10000 };
foreach (var item in items) {
    if (ids.Contains(item.Id)) { ... }
}
```

**Правильно:**

```csharp
var ids = new HashSet<int> { 1, 2, 3, ..., 10000 };
foreach (var item in items) {
    if (ids.Contains(item.Id)) { ... }
}
```

**Почему:** List.Contains — O(N), HashSet.Contains — O(1). На 10k элементов и цикле в 1k итераций разница 10000x.

## Proposed agent changes

### dex-dotnet-reviewer: добавить упоминание EF Core skill в Skill-Based Scan

**Целевой агент:** dex-dotnet-reviewer
**Фаза:** Skill-Based Deep Scan

**Изменение:** в условиях загрузки skills добавить пункт: если в diff видны `DbContext`, `DbSet`, `IQueryable`, `.Include(`, `.Where(`, `.ToListAsync()` — императивно загрузить `dex-skill-dotnet-ef-core:dotnet-ef-core` через Skill tool.

**Почему:** ревьюер пропустил N+1 в Include-цепочке потому что не загрузил skill. Триггер по ключевым словам diff'а — надёжнее.

## Skipped (already covered)

### dex-skill-dotnet-async-patterns: CancellationToken во всех async API

Уже описано в текущем skill, секция "CancellationToken propagation".

## Dropped (not actionable)

### Общая придирка к стилю именования переменных

Не обобщается в правило, субъективно.
