namespace Fulfil.Contracts;

// События заказов, которые публикует витрина и смежные команды.
public sealed record OrderPlaced(Guid OrderId, Guid CustomerId, IReadOnlyList<Domain.OrderLine> Items, DateTimeOffset PlacedAt, bool GiftWrap, string? ContactEmail);

public sealed record OrderStatusChanged(Guid OrderId, Domain.OrderStatus Status, DateTimeOffset ChangedAt);
