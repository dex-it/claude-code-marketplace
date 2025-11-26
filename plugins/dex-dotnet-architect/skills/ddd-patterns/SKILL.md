---
name: ddd-patterns
description: Domain-Driven Design тактические паттерны для .NET. Активируется при DDD, domain driven, aggregate, value object, domain event
allowed-tools: Read, Grep, Glob
---

# DDD Patterns

## Entity

Объект с идентичностью. Равенство по ID.

```csharp
public abstract class Entity
{
    public int Id { get; protected set; }

    public override bool Equals(object? obj)
    {
        if (obj is not Entity other) return false;
        if (GetType() != other.GetType()) return false;
        return Id == other.Id;
    }

    public override int GetHashCode() => Id.GetHashCode();
}
```

## Value Object

Объект без идентичности. Immutable. Равенство по значению.

```csharp
public record Money(decimal Amount, string Currency)
{
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Different currencies");
        return new Money(Amount + other.Amount, Currency);
    }
}

public record Address(string Street, string City, string PostalCode);

public record Email
{
    public string Value { get; }

    public Email(string value)
    {
        if (!value.Contains('@'))
            throw new ArgumentException("Invalid email");
        Value = value.ToLowerInvariant();
    }
}
```

## Aggregate

Группа объектов с одной точкой входа (Aggregate Root).

```csharp
public class Order : Entity
{
    public int CustomerId { get; private set; }  // ID, не навигация!
    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public static Order Create(int customerId)
    {
        var order = new Order { CustomerId = customerId };
        order.AddDomainEvent(new OrderCreatedEvent(order.Id));
        return order;
    }

    public void AddItem(int productId, int quantity, Money price)
    {
        _items.Add(new OrderItem(productId, quantity, price));
    }
}
```

## Domain Event

```csharp
public interface IDomainEvent
{
    DateTime OccurredOn { get; }
}

public record OrderCreatedEvent(int OrderId) : IDomainEvent
{
    public DateTime OccurredOn { get; } = DateTime.UtcNow;
}

// Handler
public class OrderCreatedHandler : INotificationHandler<OrderCreatedEvent>
{
    public async Task Handle(OrderCreatedEvent notification, CancellationToken ct)
    {
        await _emailService.SendConfirmationAsync(notification.OrderId);
    }
}
```

## Repository

```csharp
// Domain - интерфейс
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}

// Infrastructure - реализация
public class OrderRepository : IOrderRepository
{
    private readonly AppDbContext _context;

    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
    }
}
```

## Правила Aggregate

1. **Один Aggregate = одна транзакция**
2. **Ссылки между Aggregate только по ID**
3. **Aggregate Root - единственная точка входа**
4. **Cross-aggregate communication через Domain Events**
