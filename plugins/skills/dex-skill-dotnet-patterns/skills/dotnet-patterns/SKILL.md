---
name: dotnet-patterns
description: Принципы проектирования и паттерны в .NET. Активируется при упоминании pattern, SOLID, DI, dependency injection, design pattern, DRY, KISS, YAGNI
allowed-tools: Read, Grep, Glob
---

# .NET Patterns & Principles

## Правила

- SOLID, DRY, KISS/YAGNI — не догма, а инструмент принятия решений
- Зависи от абстракций, не от реализаций
- CancellationToken в каждом async методе
- Result pattern вместо exceptions для бизнес-ошибок
- #nullable enable во всех проектах

## SOLID

### S — Single Responsibility

```csharp
// Плохо — сервис делает всё
public class OrderService
{
    public void CreateOrder() { }
    public void SendEmail() { }       // не его дело
    public void GenerateInvoice() { } // не его дело
    public decimal CalculateTax() { } // не его дело
}

// Хорошо — каждый класс = одна причина для изменения
public class OrderService(IEmailService email, IInvoiceService invoice)
{
    public async Task CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
    {
        var order = new Order(request);
        await _repo.SaveAsync(order, ct);
        await email.SendConfirmationAsync(order, ct);
        await invoice.GenerateAsync(order, ct);
    }
}
```

### O — Open/Closed

```csharp
// Плохо — при новом типе скидки меняем класс
public decimal CalculateDiscount(Order order)
{
    if (order.Type == "VIP") return order.Total * 0.2m;
    if (order.Type == "Employee") return order.Total * 0.3m;
    // при каждом новом типе — правим этот метод
}

// Хорошо — открыт для расширения, закрыт для модификации
public interface IDiscountStrategy
{
    bool CanApply(Order order);
    decimal Calculate(Order order);
}

// Новый тип — новый класс, старый код не трогаем
public class VipDiscount : IDiscountStrategy { ... }
public class EmployeeDiscount : IDiscountStrategy { ... }
```

### L — Liskov Substitution

```csharp
// Плохо — наследник меняет контракт
public class ReadOnlyRepository : Repository
{
    public override Task SaveAsync(Entity e, CancellationToken ct)
        => throw new NotSupportedException(); // нарушает контракт базового класса
}

// Хорошо — разделяй интерфейсы
public interface IReadRepository<T> { Task<T?> GetByIdAsync(int id, CancellationToken ct); }
public interface IWriteRepository<T> : IReadRepository<T> { Task SaveAsync(T entity, CancellationToken ct); }
```

### I — Interface Segregation

```csharp
// Плохо — "толстый" интерфейс, клиенты зависят от методов которые не используют
public interface IWorker
{
    void Work();
    void Eat();    // робот не ест
    void Sleep();  // робот не спит
}

// Хорошо — мелкие интерфейсы
public interface IWorkable { void Work(); }
public interface IFeedable { void Eat(); }
```

### D — Dependency Inversion

```csharp
// Плохо — зависит от конкретной реализации
public class OrderService
{
    private readonly SqlOrderRepository _repo = new(); // привязан к SQL
}

// Хорошо — зависит от абстракции
public class OrderService(IOrderRepository repo) { }

// Program.cs
services.AddScoped<IOrderRepository, SqlOrderRepository>();
```

## DRY — Don't Repeat Yourself

```csharp
// Плохо — копипаст валидации в каждом endpoint
public async Task<IActionResult> CreateOrder(OrderDto dto)
{
    if (string.IsNullOrEmpty(dto.Name)) return BadRequest("Name required");
    if (dto.Amount <= 0) return BadRequest("Invalid amount");
    // ...
}
public async Task<IActionResult> UpdateOrder(OrderDto dto)
{
    if (string.IsNullOrEmpty(dto.Name)) return BadRequest("Name required"); // тот же код!
    if (dto.Amount <= 0) return BadRequest("Invalid amount");               // опять!
    // ...
}

// Хорошо — вынеси в валидатор (FluentValidation, или свой)
public class OrderValidator : AbstractValidator<OrderDto>
{
    public OrderValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}
```

### Но не перегибай

```csharp
// Плохо — DRY ради DRY (объединили разные вещи)
public void ProcessEntity<T>(T entity) where T : class
{
    // 200 строк с if (entity is Order) ... else if (entity is Invoice) ...
}

// Хорошо — три похожие строки лучше плохой абстракции
await ProcessOrder(order);
await ProcessInvoice(invoice);
await ProcessPayment(payment);
```

## KISS / YAGNI — не усложняй

```csharp
// Плохо — абстракция ради абстракции
public interface IOrderRepositoryFactory
{
    IOrderRepository Create(string type);
}
public class OrderRepositoryFactory : IOrderRepositoryFactory { ... }
// ... используется в одном месте для одного типа

// Хорошо — просто зарегистрируй в DI
services.AddScoped<IOrderRepository, PostgresOrderRepository>();

// Плохо — YAGNI: "а вдруг понадобится"
public class Order
{
    public string? FutureField1 { get; set; }  // "на будущее"
    public Dictionary<string, object> Metadata { get; set; } = new(); // "вдруг пригодится"
}

// Хорошо — добавишь когда понадобится
public class Order
{
    public Guid Id { get; set; }
    public decimal Total { get; set; }
    public OrderStatus Status { get; set; }
}
```

### Признаки over-engineering

- Интерфейс с одной реализацией, которая никогда не поменяется
- Generic класс, используемый для одного типа
- Factory, которая создаёт один объект
- Middleware/filter для одного endpoint
- "Extensible" архитектура для MVP

## Result Pattern

```csharp
// Когда использовать: бизнес-ошибки (not found, validation)
// Когда НЕ использовать: инфраструктурные сбои (DB down, timeout) — пусть летят exceptions

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }

    private Result(bool success, T? value, string? error)
        => (IsSuccess, Value, Error) = (success, value, error);

    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Failure(string error) => new(false, default, error);
}

// Использование
public async Task<Result<Order>> GetOrderAsync(int id, CancellationToken ct)
{
    var order = await _repo.GetByIdAsync(id, ct);
    if (order is null)
        return Result<Order>.Failure("Order not found");
    return Result<Order>.Success(order);
}
```

## Чек-лист при ревью

- [ ] Класс имеет одну ответственность (SRP)
- [ ] Новая функциональность не требует правки старого кода (OCP)
- [ ] Интерфейсы мелкие, клиенты не зависят от лишнего (ISP)
- [ ] Зависимости через DI, не new() (DIP)
- [ ] Нет копипаста логики (DRY), но и нет фальшивых абстракций
- [ ] Нет кода "на будущее" (YAGNI)
- [ ] CancellationToken пробрасывается
