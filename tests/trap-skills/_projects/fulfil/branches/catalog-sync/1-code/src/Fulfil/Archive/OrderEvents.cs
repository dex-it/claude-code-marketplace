using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed class OrderEventDoc
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string Kind { get; set; } = "";
    public string? Details { get; set; }
    public DateTimeOffset At { get; set; }
}

public sealed class OrderEvents(IMongoDatabase db)
{
    const int PageSize = 100;

    IMongoCollection<OrderEventDoc> Events => db.GetCollection<OrderEventDoc>("order_events");

    public Task AppendAsync(Guid orderId, string kind, string? details, CancellationToken ct) =>
        Events.InsertOneAsync(
            new OrderEventDoc { Id = Guid.NewGuid(), OrderId = orderId, Kind = kind, Details = details, At = DateTimeOffset.UtcNow },
            cancellationToken: ct);

    public Task<List<OrderEventDoc>> ListAsync(Guid orderId, int page, CancellationToken ct) =>
        Events.Find(e => e.OrderId == orderId)
            .SortBy(e => e.At)
            .Skip((page - 1) * PageSize)
            .Limit(PageSize)
            .ToListAsync(ct);
}
