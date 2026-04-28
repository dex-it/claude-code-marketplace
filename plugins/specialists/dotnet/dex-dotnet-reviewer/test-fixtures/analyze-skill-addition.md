# MR Analyze: dex/service-a !2255

## Proposed skill additions

### dex-skill-dotnet-ef-core: AsNoTracking для read-only запросов

**Целевой skill:** dex-skill-dotnet-ef-core
**H2-секция:** Tracking and change detection

**Drop-in:**

#### AsNoTracking для read-only запросов

**Плохо:**

```csharp
var users = await _ctx.Users.Where(u => u.IsActive).ToListAsync();
return users.Select(u => new UserDto(u.Id, u.Name));
```

**Правильно:**

```csharp
var users = await _ctx.Users.AsNoTracking().Where(u => u.IsActive).ToListAsync();
```

**Почему:** Без AsNoTracking EF создаёт snapshot каждой сущности и держит change tracker — это аллокации и память на read-only пути. На горячих GET-эндпоинтах разница в throughput до 30%.

## Skipped (already covered)

(пусто)

## Dropped (not actionable)

(пусто)
