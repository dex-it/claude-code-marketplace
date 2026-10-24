namespace Fulfil.Contracts;

// События заказов, которые публикует витрина и смежные команды.
public sealed record OrderPlaced(Guid OrderId, Guid CustomerId, IReadOnlyList<Domain.OrderLine>? Lines, DateTimeOffset PlacedAt)
{
    public IReadOnlyList<Domain.OrderLine>? Items { get; init; }
    public bool GiftWrap { get; init; }
    public string? ContactEmail { get; init; }

    public IReadOnlyList<Domain.OrderLine> ResolveLines() => Items ?? Lines ?? [];
}

public sealed record OrderStatusChanged(Guid OrderId, Domain.OrderStatus Status, DateTimeOffset ChangedAt);
