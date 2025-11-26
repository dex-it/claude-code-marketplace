---
name: ef-core
description: Entity Framework Core экспертиза - DbContext, миграции, запросы, производительность. Активируется при entity framework, ef core, dbcontext, migration, linq to entities
allowed-tools: Read, Grep, Glob
---

# Entity Framework Core

## Настройка DbContext

```csharp
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
```

## Entity Configuration

```csharp
public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Price).HasColumnType("decimal(18,2)");
        builder.HasIndex(p => p.Name).IsUnique();
    }
}
```

## Миграции

```bash
dotnet ef migrations add MigrationName    # Создать
dotnet ef database update                 # Применить
dotnet ef migrations script --idempotent  # SQL скрипт
dotnet ef migrations remove               # Удалить последнюю
```

## Запросы

### Eager Loading
```csharp
var orders = await _context.Orders
    .Include(o => o.Customer)
    .Include(o => o.OrderItems)
        .ThenInclude(oi => oi.Product)
    .ToListAsync(ct);
```

### Проекция (Select)
```csharp
// Загружает только нужные поля
var names = await _context.Products
    .Select(p => p.Name)
    .ToListAsync(ct);
```

### AsNoTracking для read-only
```csharp
var products = await _context.Products
    .AsNoTracking()
    .Where(p => p.IsActive)
    .ToListAsync(ct);
```

## CRUD Операции

### ExecuteUpdate/ExecuteDelete (EF Core 7+)
```csharp
// Update без загрузки
await _context.Products
    .Where(p => p.Id == id)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Name, "New Name"), ct);

// Delete без загрузки
await _context.Products
    .Where(p => p.Id == id)
    .ExecuteDeleteAsync(ct);
```

## Избежание N+1

```csharp
// Плохо - N+1
var orders = await _context.Orders.ToListAsync();
foreach (var order in orders)
{
    var customer = await _context.Customers.FindAsync(order.CustomerId);
}

// Хорошо - один запрос
var orders = await _context.Orders
    .Include(o => o.Customer)
    .ToListAsync(ct);
```

## Транзакции

```csharp
using var transaction = await _context.Database.BeginTransactionAsync(ct);
try
{
    await _context.Orders.AddAsync(order, ct);
    await _context.SaveChangesAsync(ct);
    await transaction.CommitAsync(ct);
}
catch
{
    await transaction.RollbackAsync(ct);
    throw;
}
```
