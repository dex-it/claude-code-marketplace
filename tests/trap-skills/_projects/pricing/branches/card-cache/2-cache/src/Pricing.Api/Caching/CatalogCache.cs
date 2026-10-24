using Microsoft.Extensions.Caching.Hybrid;
using Pricing.Api.Contracts;
using Pricing.Application.Products;
using Pricing.Domain;

namespace Pricing.Api.Caching;

public sealed class CatalogCache(HybridCache cache, ProductService products)
{
    public const string ProductsTag = "products";
    public static string CategoryTag(Category category) => $"category:{category}";

    private static readonly HybridCacheEntryOptions Entry = new() { Expiration = TimeSpan.FromMinutes(5) };

    public ValueTask<ProductDto> GetCardAsync(Guid id, CancellationToken ct) =>
        cache.GetOrCreateAsync(
            $"product:{id}",
            async token => (await products.GetAsync(id, token)).ToDto(),
            Entry,
            cancellationToken: ct);

    public ValueTask<List<ProductDto>> GetCategoryAsync(Category category, CancellationToken ct) =>
        cache.GetOrCreateAsync(
            $"category:{category}",
            async token => (await products.ListByCategoryAsync(category, token)).Select(p => p.ToDto()).ToList(),
            Entry,
            tags: [CategoryTag(category)],
            cancellationToken: ct);

    public async Task InvalidateProductAsync(Category category, CancellationToken ct) =>
        await cache.RemoveByTagAsync([ProductsTag, CategoryTag(category)], ct);

    public async Task FlushAsync(CancellationToken ct) =>
        await cache.RemoveByTagAsync(ProductsTag, ct);
}
