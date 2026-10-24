using Fulfil.Domain;

namespace Fulfil.Payments;

public sealed record OrderSubmitted(Guid OrderId, decimal Total, decimal Discount, string ReceiptEmail, IReadOnlyList<OrderLine> Lines);
public sealed record ReserveStock(Guid OrderId, IReadOnlyList<OrderLine> Lines);
public sealed record StockReserved(Guid OrderId);
public sealed record StockUnavailable(Guid OrderId);
public sealed record CapturePayment(Guid OrderId, decimal Total, decimal Discount, string ReceiptEmail);
public sealed record OrderPaid(Guid OrderId, decimal Amount);
public sealed record ShipOrder(Guid OrderId);
public sealed record OrderShipped(Guid OrderId);
public sealed record ReleaseStock(Guid OrderId);
public sealed record StockLevelReported(string Sku, int Quantity);
