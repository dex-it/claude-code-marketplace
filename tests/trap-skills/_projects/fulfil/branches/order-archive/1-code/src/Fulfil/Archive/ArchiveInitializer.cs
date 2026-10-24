using Fulfil.Domain;
using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed class ArchiveInitializer(IMongoDatabase db) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        var orders = Builders<OrderDoc>.IndexKeys;
        var pending = Builders<OrderDoc>.Filter.Eq(o => o.Status, OrderStatus.Shipped) & Builders<OrderDoc>.Filter.Eq(o => o.Mailed, false);
        await db.GetCollection<OrderDoc>("orders").Indexes.CreateOneAsync(
            new CreateIndexModel<OrderDoc>(orders.Ascending(o => o.Status), new CreateIndexOptions<OrderDoc> { PartialFilterExpression = pending }),
            cancellationToken: ct);

        await db.GetCollection<TransferLog>("stock_transfers").Indexes.CreateOneAsync(
            new CreateIndexModel<TransferLog>(
                Builders<TransferLog>.IndexKeys.Descending(t => t.At).Ascending(t => t.ToWarehouse).Ascending(t => t.Sku)),
            cancellationToken: ct);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
