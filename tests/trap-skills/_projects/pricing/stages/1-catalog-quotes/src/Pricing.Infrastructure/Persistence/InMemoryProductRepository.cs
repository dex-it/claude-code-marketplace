using Pricing.Application.Abstractions;
using Pricing.Domain;

namespace Pricing.Infrastructure.Persistence;

public sealed class InMemoryProductRepository(InMemoryStore store) : IProductRepository
{
    public Task<Product?> GetAsync(Guid id, CancellationToken ct) =>
        Task.FromResult(store.Products.GetValueOrDefault(id));

    public Task<Product?> GetBySkuAsync(string sku, CancellationToken ct) =>
        Task.FromResult(store.Products.Values.FirstOrDefault(p => p.Sku == sku));

    public Task<IReadOnlyList<Product>> ListAsync(int skip, int take, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Product>>(store.Products.Values.OrderBy(p => p.Sku).Skip(skip).Take(take).ToList());

    public Task<int> CountAsync(CancellationToken ct) => Task.FromResult(store.Products.Count);

    public Task AddAsync(Product product, CancellationToken ct)
    {
        store.Products[product.Id] = product;
        return Task.CompletedTask;
    }
}
