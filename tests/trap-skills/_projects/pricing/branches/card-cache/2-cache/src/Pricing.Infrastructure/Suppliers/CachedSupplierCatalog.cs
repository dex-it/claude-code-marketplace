using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Pricing.Application.Abstractions;

namespace Pricing.Infrastructure.Suppliers;

public sealed class CachedSupplierCatalog(SupplierApiClient inner, IMemoryCache cache, IOptions<SupplierCacheOptions> options)
    : ISupplierCatalog
{
    public Task<SupplierPrice?> GetPriceAsync(string supplierId, string sku, CancellationToken ct) =>
        // GetOrCreateAsync - один запрос к поставщику на SKU, сколько бы котировок ни пришло одновременно.
        cache.GetOrCreateAsync($"supplier-price:{sku}", async entry =>
        {
            var price = await inner.GetPriceAsync(supplierId, sku, ct);
            var o = options.Value;
            entry.AbsoluteExpirationRelativeToNow = o.Ttl;
            if (price is null && o.NotFoundTtl < o.Ttl)
                entry.AbsoluteExpirationRelativeToNow = o.NotFoundTtl;
            return price;
        });
}
