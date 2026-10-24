using System.Net.Http.Json;
using Catalog.Worker.Data;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Worker.Pricing;

public sealed class PriceSyncWorker(
    IServiceScopeFactory scopes,
    CatalogEvents events,
    IConfiguration config,
    ILogger<PriceSyncWorker> logger) : BackgroundService
{
    private static readonly Dictionary<string, decimal> PriceCache = new();
    private readonly object _statsSync = new();
    private int _changed;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(10));
        do
        {
            await SyncOnceAsync(ct);
        }
        while (await timer.WaitForNextTickAsync(ct));
    }

    private async Task SyncOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var handler = new PriceChangeHandler(db, logger);
        events.PriceChanged += handler.OnPriceChanged;

        var products = await db.Products.Select(p => new { p.Sku, p.Price }).ToListAsync(ct);
        foreach (var p in products)
        {
            var key = $"{p.Sku}:{DateTime.UtcNow:yyyyMMddHHmm}";
            if (!PriceCache.TryGetValue(key, out var price))
            {
                price = await FetchPriceAsync(p.Sku, ct);
                PriceCache[key] = price;
            }

            if (price != p.Price)
            {
                events.RaisePriceChanged(p.Sku, p.Price, price);
                lock (_statsSync) _changed++;
            }
        }

        logger.LogInformation("Price sync done, changed so far: {Changed}", _changed);
    }

    private async Task<decimal> FetchPriceAsync(string sku, CancellationToken ct)
    {
        using var http = new HttpClient { BaseAddress = new Uri(config["Supplier:BaseUrl"]!) };
        var dto = await http.GetFromJsonAsync<PriceDto>($"prices/{sku}", ct);
        return dto!.Price;
    }

    private sealed record PriceDto(string Sku, decimal Price);
}
