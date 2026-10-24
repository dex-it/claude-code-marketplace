using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed class StockRow
{
    public string Id { get; set; } = "";
    public string Sku { get; set; } = "";
    public string Warehouse { get; set; } = "";
    public int Stock { get; set; }

    public static string KeyOf(string sku, string warehouse) => $"{sku}|{warehouse}";
}

public sealed class TransferLog
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = "";
    public string FromWarehouse { get; set; } = "";
    public string ToWarehouse { get; set; } = "";
    public int Quantity { get; set; }
    public DateTimeOffset At { get; set; }
}

public sealed class StockTransfer(IMongoClient client, IMongoDatabase db)
{
    IMongoCollection<StockRow> Stock => db.GetCollection<StockRow>("warehouse_stock");
    IMongoCollection<TransferLog> Log => db.GetCollection<TransferLog>("stock_transfers");

    public async Task<bool> MoveAsync(string sku, string from, string to, int quantity, CancellationToken ct)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);
        var fromId = StockRow.KeyOf(sku, from);
        var toId = StockRow.KeyOf(sku, to);

        using var session = await client.StartSessionAsync(cancellationToken: ct);
        return await session.WithTransactionAsync(async (s, token) =>
        {
            var taken = await Stock.UpdateOneAsync(
                s,
                r => r.Id == fromId && r.Stock >= quantity,
                Builders<StockRow>.Update.Inc(r => r.Stock, -quantity),
                cancellationToken: token);
            if (taken.ModifiedCount == 0) return false;

            await Stock.UpdateOneAsync(
                s,
                r => r.Id == toId,
                Builders<StockRow>.Update.Inc(r => r.Stock, quantity).SetOnInsert(r => r.Sku, sku).SetOnInsert(r => r.Warehouse, to),
                new UpdateOptions { IsUpsert = true },
                token);
            await Log.InsertOneAsync(
                s,
                new TransferLog { Id = Guid.NewGuid(), Sku = sku, FromWarehouse = from, ToWarehouse = to, Quantity = quantity, At = DateTimeOffset.UtcNow },
                cancellationToken: token);
            return true;
        }, cancellationToken: ct);
    }

    public Task<List<TransferLog>> HistoryAsync(string sku, string toWarehouse, DateTimeOffset since, CancellationToken ct) =>
        Log.Find(t => t.Sku == sku && t.ToWarehouse == toWarehouse && t.At >= since)
            .SortByDescending(t => t.At)
            .ToListAsync(ct);
}
