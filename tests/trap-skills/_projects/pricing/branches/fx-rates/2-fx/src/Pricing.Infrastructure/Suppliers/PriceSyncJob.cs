using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pricing.Application.Abstractions;
using Pricing.Infrastructure.Persistence;

namespace Pricing.Infrastructure.Suppliers;

public sealed class PriceSyncOptions
{
    public const string Section = "PriceSync";
    public int BatchSize { get; set; } = 100;
    public TimeOnly RunAt { get; set; } = new(3, 0);
}

public sealed class PriceSyncJob(
    InMemoryStore store, ISupplierPriceBatch batch, IOptions<PriceSyncOptions> options, ILogger<PriceSyncJob> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(UntilNextRun(), stoppingToken);
            foreach (var supplier in store.Products.Values.GroupBy(p => p.SupplierId))
            {
                foreach (var chunk in supplier.Chunk(options.Value.BatchSize))
                {
                    using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    cts.CancelAfter(TimeSpan.FromSeconds(3));
                    try
                    {
                        var prices = await batch.GetPricesAsync(supplier.Key, chunk.Select(p => p.Sku).ToList(), cts.Token);
                        foreach (var price in prices.Where(p => p.Currency == "RUB"))
                        {
                            var product = chunk.First(p => p.Sku == price.Sku);
                            if (price.Price > product.BasePrice) product.ChangePrice(price.Price);
                        }
                    }
                    catch (HttpRequestException ex)
                    {
                        log.LogWarning(ex, "Синхронизация цен поставщика {SupplierId} - пачка пропущена", supplier.Key);
                    }
                }
            }
        }
    }

    private TimeSpan UntilNextRun()
    {
        var now = DateTime.Now;
        var next = now.Date + options.Value.RunAt.ToTimeSpan();
        return (next > now ? next : next.AddDays(1)) - now;
    }
}
