using Pricing.Domain;

namespace Pricing.Api.Contracts;

public sealed record ProductDto(Guid Id, string Sku, string Name, Category Category, decimal Price);

public sealed record CreateProductRequest(string Sku, string Name, Category Category, decimal BasePrice, string SupplierId);

public sealed record PageDto<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

public static class ProductMapping
{
    public static ProductDto ToDto(this Product p) => new(p.Id, p.Sku, p.Name, p.Category, p.BasePrice);
}
