using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Caching;

public sealed class StockRecalculatorJob(RedisLock locks, IMongoDatabase db, ILogger<StockRecalculatorJob> log)
    : BackgroundService
{
    static readonly TimeSpan LockTtl = TimeSpan.FromSeconds(90);

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
        var handle = await locks.TryAcquireAsync("stock", LockTtl);
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
                var filter = f.Eq("sku", row["_id"]) & (f.Exists("fence", false) | f.Lt("fence", handle.Fence));
                var update = Builders<BsonDocument>.Update.Set("stock", row["qty"]).Set("fence", handle.Fence);
                await products.UpdateOneAsync(filter, update, cancellationToken: ct);
            }
            log.LogInformation("Recalculated stock for {Count} products", totals.Count);
        }
        finally
        {
            await locks.ReleaseAsync(handle);
        }
    }
}
