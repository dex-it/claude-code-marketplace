namespace Fulfil.Contracts;

// События заказов, которые публикует витрина и смежные команды.
public sealed record OrderPlaced(Guid OrderId, Guid CustomerId, IReadOnlyList<Domain.OrderLine> Lines, DateTimeOffset PlacedAt);

public sealed record OrderStatusChanged(Guid OrderId, Domain.OrderStatus Status, DateTimeOffset ChangedAt);
