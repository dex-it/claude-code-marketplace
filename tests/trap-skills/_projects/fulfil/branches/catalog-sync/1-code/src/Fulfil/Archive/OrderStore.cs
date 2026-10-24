using Fulfil.Domain;
using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed record OrderSummary(Guid Id, OrderStatus Status);

public sealed class OrderStore(IMongoDatabase db)
{
    const int PageSize = 50;
    const int MaxTags = 5;

    IMongoCollection<OrderDoc> Orders => db.GetCollection<OrderDoc>("orders");

    public Task ArchiveAsync(Order order, Address address, IEnumerable<string> tags, CancellationToken ct)
    {
        var doc = new OrderDoc
        {
            Id = order.Id,
            CustomerId = order.CustomerId,
            Status = order.Status,
            PlacedAt = order.PlacedAt,
            Total = order.Lines.Sum(l => l.UnitPrice * l.Quantity),
            Lines = [.. order.Lines],
            ShippingAddress = address,
            Tags = tags.Take(MaxTags).ToList(),
        };
        return Orders.ReplaceOneAsync(o => o.Id == order.Id, doc, new ReplaceOptions { IsUpsert = true }, ct);
    }

    public async Task<OrderDoc?> GetAsync(Guid id, CancellationToken ct) =>
        await Orders.Find(o => o.Id == id).FirstOrDefaultAsync(ct);

    public Task<List<OrderDoc>> SearchAsync(
        Guid customerId, OrderStatus status, DateTimeOffset from, DateTimeOffset to, int page, CancellationToken ct) =>
        Orders.Find(o => o.CustomerId == customerId && o.Status == status && o.PlacedAt >= from && o.PlacedAt < to)
            .SortByDescending(o => o.PlacedAt)
            .Skip((page - 1) * PageSize)
            .Limit(PageSize)
            .ToListAsync(ct);

    public Task<List<OrderSummary>> ListMineAsync(Guid customerId, int page, CancellationToken ct) =>
        Orders.Find(o => o.CustomerId == customerId)
            .SortByDescending(o => o.PlacedAt)
            .Skip((page - 1) * PageSize)
            .Limit(PageSize)
            .Project(o => new OrderSummary(o.Id, o.Status))
            .ToListAsync(ct);

    public Task<List<OrderDoc>> ExportAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct) =>
        Orders.Find(o => o.PlacedAt >= from && o.PlacedAt < to).ToListAsync(ct);

    public Task SaveDraftAsync(CartDraft draft, CancellationToken ct)
    {
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        return db.GetCollection<CartDraft>("cart_drafts")
            .ReplaceOneAsync(d => d.Id == draft.Id, draft, new ReplaceOptions { IsUpsert = true }, ct);
    }
}
