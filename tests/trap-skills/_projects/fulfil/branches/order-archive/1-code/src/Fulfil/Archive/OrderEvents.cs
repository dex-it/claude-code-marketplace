using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed class OrderEvents(IMongoDatabase db)
{
    const int PageSize = 100;

    IMongoCollection<OrderDoc> Orders => db.GetCollection<OrderDoc>("orders");

    public Task AppendAsync(Guid orderId, string kind, string? details, CancellationToken ct) =>
        Orders.UpdateOneAsync(
            o => o.Id == orderId,
            Builders<OrderDoc>.Update.Push(o => o.Events, new OrderEvent(kind, details, DateTimeOffset.UtcNow)),
            cancellationToken: ct);

    public async Task<List<OrderEvent>> ListAsync(Guid orderId, int page, CancellationToken ct)
    {
        var events = await Orders.Find(o => o.Id == orderId).Project(o => o.Events).FirstOrDefaultAsync(ct);
        return events?.Skip((page - 1) * PageSize).Take(PageSize).ToList() ?? [];
    }
}
