namespace Depot.Contracts;

public sealed record StockDto(string Sku, string Warehouse, int Quantity);

public sealed record ReceiveRequest(string Warehouse, int Quantity);
