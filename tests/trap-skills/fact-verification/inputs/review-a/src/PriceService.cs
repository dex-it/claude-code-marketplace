using Microsoft.Extensions.Caching.Memory;

namespace Pricing.Api;

public sealed class PriceService(IMemoryCache cache, ISupplierClient supplier)
{
    // GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
    // параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
    public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
    {
        var price = await cache.GetOrCreateAsync($"price:{sku}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await supplier.GetPriceAsync(sku, ct);
        });
        return price;
    }

    public async Task<decimal> GetFinalPriceAsync(string sku, int discountPercent, CancellationToken ct)
    {
        var basePrice = await GetBasePriceAsync(sku, ct);
        var discounted = basePrice - basePrice * (discountPercent / 100);
        return Math.Round(discounted, 2);
    }
}
