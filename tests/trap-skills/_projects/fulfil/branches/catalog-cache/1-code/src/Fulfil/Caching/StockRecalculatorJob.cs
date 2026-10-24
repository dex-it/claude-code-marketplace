using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Caching;

public sealed class StockRecalculatorJob(RedisLock locks, IMongoDatabase db, ILogger<StockRecalculatorJob> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                await RunOnceAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Stock recalculation failed");
            }
        }
    }

    async Task RunOnceAsync(CancellationToken ct)
    {
        var handle = await locks.TryAcquireAsync("stock");
        if (handle is null) return;

        try
        {
            var totals = await db.GetCollection<BsonDocument>("stock_movements")
                .Aggregate()
                .Group(new BsonDocument { { "_id", "$sku" }, { "qty", new BsonDocument("$sum", "$delta") } })
                .ToListAsync(ct);

            var f = Builders<BsonDocument>.Filter;
            var products = db.GetCollection<BsonDocument>("products");
            foreach (var row in totals)
            {
                var update = Builders<BsonDocument>.Update.Set("stock", row["qty"]);
                await products.UpdateOneAsync(f.Eq("sku", row["_id"]), update, cancellationToken: ct);
            }
            log.LogInformation("Recalculated stock for {Count} products", totals.Count);
        }
        finally
        {
            await locks.ReleaseAsync(handle);
        }
    }
}
