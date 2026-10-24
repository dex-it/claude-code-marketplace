using Fulfil.Domain;
using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed class ArchiveInitializer(IMongoDatabase db) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        var orders = Builders<OrderDoc>.IndexKeys;
        var pending = Builders<OrderDoc>.Filter.Eq(o => o.Status, OrderStatus.Shipped) & Builders<OrderDoc>.Filter.Eq(o => o.Mailed, false);
        await db.GetCollection<OrderDoc>("orders").Indexes.CreateManyAsync(
        [
            new CreateIndexModel<OrderDoc>(orders.Ascending(o => o.CustomerId).Ascending(o => o.Status).Descending(o => o.PlacedAt)),
            new CreateIndexModel<OrderDoc>(orders.Ascending(o => o.CustomerId).Descending(o => o.PlacedAt)),
            new CreateIndexModel<OrderDoc>(orders.Ascending(o => o.Status), new CreateIndexOptions<OrderDoc> { PartialFilterExpression = pending }),
        ], ct);

        await db.GetCollection<OrderEventDoc>("order_events").Indexes.CreateOneAsync(
            new CreateIndexModel<OrderEventDoc>(Builders<OrderEventDoc>.IndexKeys.Ascending(e => e.OrderId).Ascending(e => e.At)),
            cancellationToken: ct);

        await db.GetCollection<CartDraft>("cart_drafts").Indexes.CreateOneAsync(
            new CreateIndexModel<CartDraft>(
                Builders<CartDraft>.IndexKeys.Ascending(d => d.UpdatedAt),
                new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(30) }),
            cancellationToken: ct);

        await db.GetCollection<TransferLog>("stock_transfers").Indexes.CreateOneAsync(
            new CreateIndexModel<TransferLog>(
                Builders<TransferLog>.IndexKeys.Ascending(t => t.Sku).Ascending(t => t.ToWarehouse).Descending(t => t.At)),
            cancellationToken: ct);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
