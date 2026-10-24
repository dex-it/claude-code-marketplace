using Pricing.Application.Abstractions;
using Pricing.Domain;

namespace Pricing.Tests;

/// <summary>Общий тестовый каталог: SKU-42 - молоко за 100, поставщик sup-1.</summary>
public sealed class TestCatalog : IProductRepository
{
    public static readonly List<Product> Products =
    [
        new(Guid.Parse("00000000-0000-0000-0000-000000000042"), "SKU-42", "Молоко", Category.Grocery, 100m, "sup-1"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000043"), "SKU-43", "Порошок", Category.Household, 450m, "sup-2"),
    ];

    public Task<Product?> GetAsync(Guid id, CancellationToken ct) =>
        Task.FromResult(Products.FirstOrDefault(p => p.Id == id));

    public Task<Product?> GetBySkuAsync(string sku, CancellationToken ct) =>
        Task.FromResult(Products.FirstOrDefault(p => p.Sku == sku));

    public Task<IReadOnlyList<Product>> ListAsync(int skip, int take, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Product>>(Products.Skip(skip).Take(take).ToList());

    public Task<int> CountAsync(CancellationToken ct) => Task.FromResult(Products.Count);

    public Task AddAsync(Product product, CancellationToken ct)
    {
        Products.Add(product);
        return Task.CompletedTask;
    }
}
