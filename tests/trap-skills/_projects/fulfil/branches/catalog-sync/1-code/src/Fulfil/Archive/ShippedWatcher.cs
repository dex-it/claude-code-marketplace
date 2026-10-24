using Fulfil.Domain;
using MongoDB.Driver;

namespace Fulfil.Archive;

public interface IMailer
{
    Task SendShippedAsync(Guid orderId, CancellationToken ct);
}

public sealed class LogMailer(ILogger<LogMailer> log) : IMailer
{
    public Task SendShippedAsync(Guid orderId, CancellationToken ct)
    {
        log.LogInformation("Shipped notification queued for order {OrderId}", orderId);
        return Task.CompletedTask;
    }
}

public sealed class ShippedWatcher(IMongoDatabase db, IMailer mailer, OrderEvents events, ILogger<ShippedWatcher> log)
    : BackgroundService
{
    IMongoCollection<OrderDoc> Orders => db.GetCollection<OrderDoc>("orders");

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await CatchUpAsync(ct);
                await WatchAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Shipped watcher failed");
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
        }
    }

    async Task CatchUpAsync(CancellationToken ct)
    {
        var ids = await Orders.Find(o => o.Status == OrderStatus.Shipped && o.Mailed == false)
            .Project(o => o.Id)
            .ToListAsync(ct);
        foreach (var id in ids)
            await NotifyAsync(id, ct);
    }

    async Task WatchAsync(CancellationToken ct)
    {
        var pipeline = new EmptyPipelineDefinition<ChangeStreamDocument<OrderDoc>>()
            .Match(c => (c.OperationType == ChangeStreamOperationType.Insert
                         || c.OperationType == ChangeStreamOperationType.Update
                         || c.OperationType == ChangeStreamOperationType.Replace)
                        && c.FullDocument.Status == OrderStatus.Shipped);
        var options = new ChangeStreamOptions { FullDocument = ChangeStreamFullDocumentOption.UpdateLookup };

        using var cursor = await Orders.WatchAsync(pipeline, options, ct);
        await cursor.ForEachAsync(change => NotifyAsync(change.FullDocument.Id, ct), ct);
    }

    async Task NotifyAsync(Guid orderId, CancellationToken ct)
    {
        var claimed = await Orders.FindOneAndUpdateAsync(
            o => o.Id == orderId && o.Status == OrderStatus.Shipped && o.Mailed == false,
            Builders<OrderDoc>.Update.Set(o => o.Mailed, true),
            cancellationToken: ct);
        if (claimed is null) return;

        try
        {
            await mailer.SendShippedAsync(orderId, ct);
        }
        catch
        {
            await Orders.UpdateOneAsync(o => o.Id == orderId, Builders<OrderDoc>.Update.Set(o => o.Mailed, false), cancellationToken: CancellationToken.None);
            throw;
        }
        await events.AppendAsync(orderId, "ShippedMailed", null, ct);
    }
}
