namespace Fulfil.Domain;

public enum OrderStatus { Placed, Paid, Shipped, Cancelled }

public sealed record OrderLine(string Sku, int Quantity, decimal UnitPrice);

public sealed record Order(
    Guid Id,
    Guid CustomerId,
    OrderStatus Status,
    IReadOnlyList<OrderLine> Lines,
    DateTimeOffset PlacedAt)
{
    public decimal Total => Lines.Sum(l => l.Quantity * l.UnitPrice);
}
