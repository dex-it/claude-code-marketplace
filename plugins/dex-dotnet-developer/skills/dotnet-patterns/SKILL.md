---
name: dotnet-patterns
description: Паттерны проектирования и best practices в .NET, SOLID принципы. Активируется при упоминании pattern, SOLID, DI, dependency injection, design pattern
allowed-tools: Read, Grep, Glob
---

# .NET Patterns & Best Practices

## SOLID Принципы

### S - Single Responsibility Principle

Класс должен иметь только одну причину для изменения.

```csharp
// Плохо - слишком много ответственностей
public class OrderService
{
    public void CreateOrder() { }
    public void SendEmail() { }       // не его ответственность
    public void GenerateInvoice() { } // не его ответственность
}

// Хорошо - разделено по ответственностям
public class OrderService
{
    private readonly IEmailService _emailService;
    private readonly IInvoiceService _invoiceService;

    public async Task CreateOrderAsync(CreateOrderRequest request)
    {
        var order = new Order(request);
        await SaveOrderAsync(order);

        await _emailService.SendOrderConfirmationAsync(order);
        await _invoiceService.GenerateAsync(order);
    }
}
```

### D - Dependency Inversion Principle

Зависеть от абстракций, не от конкретных реализаций.

```csharp
// Плохо - зависит от конкретной реализации
public class OrderService
{
    private readonly SqlOrderRepository _repository = new();
}

// Хорошо - зависит от интерфейса
public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }
}

// Регистрация в Program.cs:
services.AddScoped<IOrderRepository, SqlOrderRepository>();
```

## Паттерны

### Repository Pattern

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<List<T>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(T entity, CancellationToken ct = default);
    Task UpdateAsync(T entity, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
```

### Unit of Work Pattern

```csharp
public interface IUnitOfWork : IDisposable
{
    IOrderRepository Orders { get; }
    ICustomerRepository Customers { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
```

### Result Pattern (вместо exceptions)

```csharp
public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }

    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Failure(string error) => new(false, default, error);
}

// Использование:
public async Task<Result<Order>> GetOrderAsync(int id)
{
    var order = await _repository.GetByIdAsync(id);
    if (order == null)
        return Result<Order>.Failure("Order not found");
    return Result<Order>.Success(order);
}
```

### Options Pattern

```csharp
// appsettings.json
{
  "EmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "Port": 587
  }
}

// Options class
public class EmailSettings
{
    public string SmtpServer { get; set; } = string.Empty;
    public int Port { get; set; }
}

// Program.cs
services.Configure<EmailSettings>(configuration.GetSection("EmailSettings"));

// Использование
public class EmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }
}
```

## Best Practices

### CancellationToken везде

```csharp
public async Task<List<Order>> GetOrdersAsync(CancellationToken ct = default)
{
    return await _context.Orders
        .Where(o => o.IsActive)
        .ToListAsync(ct);
}
```

### Nullable Reference Types

```csharp
#nullable enable

public class Product
{
    public string Name { get; set; } = string.Empty;  // не null
    public string? Description { get; set; }          // может быть null
}
```
