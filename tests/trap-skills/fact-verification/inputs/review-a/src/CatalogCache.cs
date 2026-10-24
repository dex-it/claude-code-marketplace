using Microsoft.Extensions.Caching.Hybrid;

namespace Pricing.Api;

public sealed class CatalogCache(HybridCache cache, ICatalogRepository repo)
{
    public ValueTask<CatalogPage> GetPageAsync(int page, CancellationToken ct) =>
        cache.GetOrCreateAsync(
            $"catalog:page:{page}",
            async token => await repo.LoadPageAsync(page, token),
            tags: ["catalog"],
            cancellationToken: ct);

    // Вызывается из обработчика события "каталог обновлён".
    public async Task InvalidateAsync(CancellationToken ct)
    {
        await cache.EvictByTagAsync("catalog", ct);
    }
}
