---
name: clean-architecture
description: Clean Architecture паттерны для ASP.NET Core, структура слоёв, правила зависимостей. Активируется при clean architecture, onion, hexagonal, слои приложения
allowed-tools: Read, Grep, Glob
---

# Clean Architecture

## Принцип зависимостей

Зависимости направлены ВНУТРЬ. Внутренние слои не знают о внешних.

```
┌─────────────────────────────────────────────┐
│                    API                       │
│  ┌─────────────────────────────────────┐    │
│  │           Infrastructure             │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │        Application          │    │    │
│  │  │  ┌─────────────────────┐    │    │    │
│  │  │  │      Domain         │    │    │    │
│  │  │  └─────────────────────┘    │    │    │
│  │  └─────────────────────────────┘    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Структура проекта

```
src/
├── Domain/                 # Без внешних зависимостей!
│   ├── Entities/
│   ├── ValueObjects/
│   ├── Events/
│   ├── Interfaces/
│   └── Exceptions/
│
├── Application/            # Зависит от Domain
│   ├── Commands/
│   ├── Queries/
│   ├── DTOs/
│   ├── Interfaces/
│   └── Behaviors/
│
├── Infrastructure/         # Реализует Application interfaces
│   ├── Persistence/
│   ├── Identity/
│   └── Messaging/
│
└── Api/                    # Entry point
    ├── Controllers/
    └── Middleware/
```

## Domain Layer

```csharp
// Entities/Entity.cs
public abstract class Entity
{
    public int Id { get; protected set; }
    private readonly List<IDomainEvent> _domainEvents = new();
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
}

// ValueObjects/Money.cs
public record Money(decimal Amount, string Currency);

// Events/OrderCreatedEvent.cs
public record OrderCreatedEvent(int OrderId) : IDomainEvent;
```

## Application Layer

```csharp
// Commands/CreateOrder/CreateOrderCommand.cs
public record CreateOrderCommand(int CustomerId, List<OrderItemDto> Items)
    : IRequest<Result<int>>;

// Commands/CreateOrder/CreateOrderHandler.cs
public class CreateOrderHandler : IRequestHandler<CreateOrderCommand, Result<int>>
{
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public async Task<Result<int>> Handle(CreateOrderCommand request, CancellationToken ct)
    {
        var order = Order.Create(request.CustomerId);
        await _orders.AddAsync(order, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return Result<int>.Success(order.Id);
    }
}
```

## Infrastructure Layer

```csharp
// Persistence/AppDbContext.cs
public class AppDbContext : DbContext, IUnitOfWork
{
    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        // Dispatch domain events
        var events = GetDomainEvents();
        var result = await base.SaveChangesAsync(ct);
        await PublishEvents(events, ct);
        return result;
    }
}
```

## DI Registration

```csharp
// Program.cs
// Application
services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(CreateOrderCommand).Assembly));
services.AddValidatorsFromAssembly(typeof(CreateOrderValidator).Assembly);

// Infrastructure
services.AddDbContext<AppDbContext>();
services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>());
services.AddScoped<IOrderRepository, OrderRepository>();
```

## Чек-лист

- Domain.csproj не имеет PackageReference
- Application зависит только от Domain
- Infrastructure реализует интерфейсы из Application
- Api не содержит бизнес-логики
- Controllers только маршрутизируют запросы
