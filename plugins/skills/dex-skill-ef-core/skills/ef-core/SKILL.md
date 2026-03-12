---
name: ef-core
description: Entity Framework Core — производительность, блокировки, миграции. Активируется при entity framework, ef core, dbcontext, migration, linq to entities, N+1, concurrency, locking
allowed-tools: Read, Grep, Glob
---

# Entity Framework Core

## Правила

- AsNoTracking для read-only запросов
- Select проекция вместо загрузки всей entity
- Include для связанных данных (не ленивая загрузка, не N+1)
- ExecuteUpdate/ExecuteDelete для bulk операций (EF 7+)
- CancellationToken в каждом async вызове
- Add() вместо AddAsync() — AddAsync нужен только для HiLo sequence генераторов
- Non-nullable FK = required связь = каскадное удаление по умолчанию
- Nullable FK = optional связь = без каскадного удаления
- Не используй cascade delete при soft-delete
- IEntityTypeConfiguration для конфигурации, не Fluent API в OnModelCreating
- Миграции — idempotent скрипты для production

## Анти-паттерны запросов

> Общие LINQ-паттерны (фильтрация, проекция, Count/Any, коллекции) — см. `dex-skill-linq-optimization`

```csharp
// Плохо — N+1: цикл запросов к связанным данным
var orders = await _context.Orders.ToListAsync(ct);
foreach (var order in orders)
{
    var customer = await _context.Customers.FindAsync(order.CustomerId); // N запросов!
}

// Хорошо — один запрос с Include
var orders = await _context.Orders
    .Include(o => o.Customer)
    .ToListAsync(ct);

// Плохо — ленивая загрузка (скрытый N+1)
var orders = await _context.Orders.ToListAsync(ct);
var name = orders[0].Customer.Name; // незаметный запрос к БД!

// Хорошо — явный Include или проекция
var orders = await _context.Orders
    .Select(o => new OrderDto(o.Id, o.Customer.Name))
    .ToListAsync(ct);
```

## Tracking

```csharp
// Read-only — без отслеживания (быстрее, меньше памяти)
var products = await _context.Products
    .AsNoTracking()
    .Where(p => p.IsActive)
    .ToListAsync(ct);

// Нужно обновлять — с tracking (по умолчанию)
var product = await _context.Products.FindAsync(id, ct);
product.Price = newPrice;
await _context.SaveChangesAsync(ct);

// Глобально для read-heavy сервисов
services.AddDbContext<AppDbContext>(o => o
    .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

// Отладка — что отслеживается перед SaveChanges
_context.ChangeTracker.DetectChanges();
Console.WriteLine(_context.ChangeTracker.DebugView.LongView);

// Проверка — есть ли вообще изменения (SaveChanges будет no-op если нет)
if (_context.ChangeTracker.HasChanges())
    await _context.SaveChangesAsync(ct);
```

## Add vs AddAsync

```csharp
// Плохо — AddAsync без необходимости (делает доп. запрос к БД)
await _context.Products.AddAsync(product, ct);

// Хорошо — Add() для обычных сценариев (Guid, client-generated id)
_context.Products.Add(product);
await _context.SaveChangesAsync(ct);

// AddAsync нужен ТОЛЬКО при HiLo sequence генераторе
// когда EF должен получить блок id из БД перед вставкой
// builder.Property(p => p.Id).UseHiLo("product_hilo_seq");
```

## Cascade Delete & Foreign Keys

```csharp
// Non-nullable FK → required связь → cascade delete по умолчанию
public class Post
{
    public Guid BlogId { get; set; }           // required
    [ForeignKey(nameof(BlogId))]
    public Blog Blog { get; set; } = null!;
}
// Удаление Blog автоматически удалит все Posts

// Nullable FK → optional связь → без cascade delete
public class Post
{
    public Guid? AuthorId { get; set; }        // optional
    [ForeignKey(nameof(AuthorId))]
    public User? Author { get; set; }
}
// Удаление User НЕ удалит Posts, AuthorId станет null
```

### Orphans — удаление "осиротевших" записей

```csharp
// Удаление связи без удаления parent
blog.Posts.Clear();                    // все посты "осиротели"
await _context.SaveChangesAsync(ct);   // EF удалит осиротевшие посты (required FK)

// Или по одному:
post.Blog = null;  // для optional FK — обнулит FK
                   // для required FK — EF удалит post
```

### Правила cascade

| FK | Связь | При удалении parent | При обрыве связи |
|----|-------|---------------------|------------------|
| `Guid BlogId` | Required | Cascade delete | Delete orphan |
| `Guid? BlogId` | Optional | Set null | Set null |

### Soft-delete + cascade = опасно

```csharp
// ОПАСНО — БД каскадно УДАЛИТ дочерние записи, даже если parent soft-deleted
// Если используешь soft-delete, отключи cascade в БД:
builder.HasOne(p => p.Blog)
    .WithMany(b => b.Posts)
    .OnDelete(DeleteBehavior.ClientCascade); // только через EF, не через БД

// Или полностью запрети:
.OnDelete(DeleteBehavior.Restrict); // ошибка при попытке удалить parent с children
```

## Bulk Operations (EF 7+)

```csharp
// Обновление без загрузки в память
await _context.Products
    .Where(p => p.Category == "old")
    .ExecuteUpdateAsync(s => s
        .SetProperty(p => p.Category, "archived")
        .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), ct);

// Удаление без загрузки
await _context.Products
    .Where(p => p.IsDeleted)
    .ExecuteDeleteAsync(ct);
```

### Периодическая очистка — чаще и меньше

```csharp
// Плохо — раз в сутки удаляем миллион записей
// Блокирует таблицу, раздувает лог транзакций, тормозит всё
await _context.AuditLogs
    .Where(l => l.CreatedAt < DateTime.UtcNow.AddMonths(-3))
    .ExecuteDeleteAsync(ct); // 1M строк одной транзакцией

// Хорошо — каждый час удаляем батчами
int deleted;
do
{
    deleted = await _context.AuditLogs
        .Where(l => l.CreatedAt < DateTime.UtcNow.AddMonths(-3))
        .Take(1000)                    // батч
        .ExecuteDeleteAsync(ct);

    if (deleted > 0)
        await Task.Delay(100, ct);     // пауза между батчами
} while (deleted > 0);
```

**Почему:** маленькие транзакции = меньше блокировок, меньше нагрузка на WAL/лог, предсказуемое время выполнения.

## Concurrency — оптимистичная блокировка

```csharp
// Entity с ConcurrencyToken
public class Order
{
    public Guid Id { get; set; }
    public decimal Total { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!; // SQL Server

    // Или через Fluent API для PostgreSQL:
    // builder.Property(o => o.Version).IsRowVersion();
    // builder.UseXminAsConcurrencyToken(); // PostgreSQL xmin
}

// Обработка конфликта
try
{
    product.Price = newPrice;
    await _context.SaveChangesAsync(ct);
}
catch (DbUpdateConcurrencyException ex)
{
    var entry = ex.Entries.Single();
    var dbValues = await entry.GetDatabaseValuesAsync(ct);

    if (dbValues is null)
    {
        // Запись удалена другим пользователем
        throw new NotFoundException();
    }

    // Стратегия: перезаписать (client wins)
    entry.OriginalValues.SetValues(dbValues);
    await _context.SaveChangesAsync(ct);

    // Или: отклонить (database wins)
    // entry.CurrentValues.SetValues(dbValues);
    // entry.State = EntityState.Unchanged;
}
```

## Пессимистичная блокировка

```csharp
// PostgreSQL: SELECT ... FOR UPDATE — обязательно внутри транзакции!
await using var tx = await _context.Database.BeginTransactionAsync(ct);
try
{
    var order = await _context.Orders
        .FromSqlInterpolated($"SELECT * FROM orders WHERE id = {id} FOR UPDATE")
        .SingleAsync(ct);

    order.Status = newStatus;
    await _context.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
}
catch
{
    await tx.RollbackAsync(ct);
    throw;
}
```

## Connection & Performance

```csharp
// Connection pooling — настрой размер пула
services.AddDbContext<AppDbContext>(o => o
    .UseNpgsql(connectionString, npgsql => npgsql
        .CommandTimeout(30)
        .EnableRetryOnFailure(3)));

// Compiled queries — для hot paths
private static readonly Func<AppDbContext, int, CancellationToken, Task<Order?>> GetOrderById =
    EF.CompileAsyncQuery((AppDbContext ctx, int id, CancellationToken ct) =>
        ctx.Orders.FirstOrDefault(o => o.Id == id));

// Вызов
var order = await GetOrderById(_context, id, ct);

// Split queries — для сложных Include (предотвращает cartesian explosion)
var orders = await _context.Orders
    .Include(o => o.Items)
    .Include(o => o.Payments)
    .AsSplitQuery()
    .ToListAsync(ct);
```

## Миграции

```bash
dotnet ef migrations add MigrationName    # Создать
dotnet ef database update                 # Применить
dotnet ef migrations script --idempotent  # Idempotent SQL для production
dotnet ef migrations remove               # Удалить последнюю (не применённую)
```

### Правила миграций
- Production — только idempotent скрипты, не `dotnet ef database update`
- Не меняй уже применённые миграции
- Одна миграция = одно логическое изменение
- Данные мигрируй отдельно от схемы

## Чек-лист

- [ ] AsNoTracking для read-only запросов
- [ ] Нет N+1 (Include или проекция)
- [ ] Select проекция для списков и API responses
- [ ] Bulk операции через ExecuteUpdate/Delete, не цикл SaveChanges
- [ ] ConcurrencyToken на entity, которые редактируются конкурентно
- [ ] Индексы на поля в Where/OrderBy
- [ ] CancellationToken пробрасывается
