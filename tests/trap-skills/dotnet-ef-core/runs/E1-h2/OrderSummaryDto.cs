namespace Shop.Data;

public sealed record OrderSummaryDto(Guid Id, string CustomerName, decimal Total, int ItemCount);
