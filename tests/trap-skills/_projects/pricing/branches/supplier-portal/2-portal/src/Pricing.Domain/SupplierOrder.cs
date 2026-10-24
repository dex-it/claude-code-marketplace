namespace Pricing.Domain;

public enum SupplierOrderState
{
    New,
    Accepted,
    Confirmed,
    Rejected,
    Cancelled,
}

public sealed record SupplierOrderLine(string Sku, int Quantity, decimal PurchasePrice);

public sealed class SupplierOrder
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string SupplierId { get; init; }
    public required int Number { get; init; }
    public List<SupplierOrderLine> Lines { get; init; } = [];
    public string? InternalNote { get; set; }
    public Dictionary<string, string> Tags { get; init; } = [];
    public decimal CostTotal { get; set; }
    public SupplierOrderState State { get; set; } = SupplierOrderState.New;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public class PortalException(string code, string message, IDictionary<string, object?>? extensions = null)
    : DomainException(code, message)
{
    public IDictionary<string, object?> Extensions { get; } = extensions ?? new Dictionary<string, object?>();
}
