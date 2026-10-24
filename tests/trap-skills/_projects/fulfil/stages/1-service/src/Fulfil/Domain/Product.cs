namespace Fulfil.Domain;

public sealed record Product(
    string Sku,
    string Name,
    string Description,
    string Category,
    decimal Price,
    int Stock);
