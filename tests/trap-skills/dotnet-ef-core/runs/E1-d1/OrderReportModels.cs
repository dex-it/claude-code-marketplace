namespace Shop.Data;

/// <summary>
/// Read-only row for the orders report page.
/// </summary>
public sealed record OrderSummaryDto(Guid OrderId, string CustomerName, decimal Total, int ItemCount);
