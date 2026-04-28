# MR Analyze: dex/service-a !2255

## Proposed skill additions

### dex-skill-dotnet-ef-core: DbContext Pooling и захват состояния

**Целевой skill:** dex-skill-dotnet-ef-core
**H2-секция:** DbContext lifetime

**Drop-in:**

#### Pooling + поля экземпляра DbContext

**Плохо:**

```csharp
public class AppDbContext : DbContext
{
    private string? _currentTenant;
    public void SetTenant(string t) => _currentTenant = t;
}
services.AddDbContextPool<AppDbContext>(...);
```

**Правильно:** не хранить мутируемое состояние в полях DbContext; tenant/user-context передавать через scoped accessor (`ITenantProvider`), который инжектится в `OnConfiguring` / query filters. Если состояние действительно нужно — отказаться от `AddDbContextPool` в пользу `AddDbContext`.

**Почему:** `AddDbContextPool` переиспользует экземпляры DbContext между запросами. Любое поле, заполненное в одном запросе, утечёт в следующий — race condition с непредсказуемым tenant/user-фильтром. Pool принципиально несовместим с per-request состоянием в самом контексте.

## Skipped (already covered)

(пусто)

## Dropped (not actionable)

(пусто)
