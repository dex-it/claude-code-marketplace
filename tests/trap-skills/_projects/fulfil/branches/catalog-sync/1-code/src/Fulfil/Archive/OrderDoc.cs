using Fulfil.Domain;

namespace Fulfil.Archive;

public sealed record Address(string Street, string City, string PostalCode);

public sealed class OrderDoc
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public OrderStatus Status { get; set; }
    public DateTimeOffset PlacedAt { get; set; }
    public decimal Total { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
    public Address ShippingAddress { get; set; } = new("", "", "");
    public List<string> Tags { get; set; } = [];
    public bool Mailed { get; set; }
}

public sealed class CartDraft
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
    public DateTimeOffset UpdatedAt { get; set; }
}
