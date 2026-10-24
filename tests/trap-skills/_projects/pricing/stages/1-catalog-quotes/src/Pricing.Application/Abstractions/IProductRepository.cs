using Pricing.Domain;

namespace Pricing.Application.Abstractions;

public interface IProductRepository
{
    Task<Product?> GetAsync(Guid id, CancellationToken ct);
    Task<Product?> GetBySkuAsync(string sku, CancellationToken ct);
    Task<IReadOnlyList<Product>> ListAsync(int skip, int take, CancellationToken ct);
    Task<int> CountAsync(CancellationToken ct);
    Task AddAsync(Product product, CancellationToken ct);
}
