using Fulfil.Domain;

namespace Fulfil.Archive;

public sealed record Address(string Street, string City, string PostalCode);

public sealed record CustomerInfo(string Name, string Email);

public sealed record OrderEvent(string Kind, string? Details, DateTimeOffset At);

public sealed class AddressDoc
{
    public Guid Id { get; set; }
    public string Street { get; set; } = "";
    public string City { get; set; } = "";
    public string PostalCode { get; set; } = "";
}

public sealed class OrderDoc
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerEmail { get; set; } = "";
    public OrderStatus Status { get; set; }
    public DateTimeOffset PlacedAt { get; set; }
    public double Total { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public List<OrderEvent> Events { get; set; } = [];
    public bool Mailed { get; set; }
}

public sealed class CartDraft
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
    public DateTimeOffset UpdatedAt { get; set; }
}
