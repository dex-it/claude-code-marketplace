using Fulfil.Domain;
using Fulfil.Options;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed record OrderSummary(Guid Id, OrderStatus Status);

public sealed record OrderView(OrderDoc Order, AddressDoc? Address);

public sealed class OrderStore(IOptions<FulfilOptions> options)
{
    const int PageSize = 50;
    const int MaxTags = 5;

    IMongoCollection<T> Collection<T>(string name) =>
        new MongoClient(options.Value.MongoConnectionString).GetDatabase(options.Value.MongoDatabase).GetCollection<T>(name);

    public async Task ArchiveAsync(
        Order order, Address address, CustomerInfo customer, IEnumerable<string> tags, CancellationToken ct)
    {
        var doc = new OrderDoc
        {
            Id = order.Id,
            CustomerId = order.CustomerId,
            CustomerName = customer.Name,
            CustomerEmail = customer.Email,
            Status = order.Status,
            PlacedAt = order.PlacedAt,
            Total = order.Lines.Sum(l => (double)l.UnitPrice * l.Quantity),
            Lines = [.. order.Lines],
            Tags = tags.Take(MaxTags).ToList(),
        };
        await Collection<OrderDoc>("orders")
            .ReplaceOneAsync(o => o.Id == order.Id, doc, new ReplaceOptions { IsUpsert = true }, ct);

        var addressDoc = new AddressDoc { Id = order.Id, Street = address.Street, City = address.City, PostalCode = address.PostalCode };
        await Collection<AddressDoc>("addresses")
            .ReplaceOneAsync(a => a.Id == order.Id, addressDoc, new ReplaceOptions { IsUpsert = true }, ct);
    }

    public async Task<OrderView?> GetAsync(Guid id, CancellationToken ct)
    {
        var order = await Collection<OrderDoc>("orders").Find(o => o.Id == id).FirstOrDefaultAsync(ct);
        if (order is null) return null;

        var address = await Collection<AddressDoc>("addresses").Find(a => a.Id == id).FirstOrDefaultAsync(ct);
        return new OrderView(order, address);
    }

    public Task<List<OrderDoc>> SearchAsync(
        Guid customerId, OrderStatus status, DateTimeOffset from, DateTimeOffset to, int page, CancellationToken ct) =>
        Collection<OrderDoc>("orders")
            .Find(o => o.CustomerId == customerId && o.Status == status && o.PlacedAt >= from && o.PlacedAt < to)
            .SortByDescending(o => o.PlacedAt)
            .Skip(page * PageSize)
            .Limit(PageSize)
            .ToListAsync(ct);

    public async Task<List<OrderSummary>> ListMineAsync(Guid customerId, int page, CancellationToken ct)
    {
        var orders = await Collection<OrderDoc>("orders")
            .Find(o => o.CustomerId == customerId)
            .SortByDescending(o => o.PlacedAt)
            .Skip((page - 1) * PageSize)
            .Limit(PageSize)
            .ToListAsync(ct);
        return orders.Select(o => new OrderSummary(o.Id, o.Status)).ToList();
    }

    public Task<List<OrderDoc>> ExportAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct) =>
        Collection<OrderDoc>("orders").Find(o => o.PlacedAt >= from && o.PlacedAt < to).ToListAsync(ct);

    public Task SaveDraftAsync(CartDraft draft, CancellationToken ct)
    {
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        return Collection<CartDraft>("cart_drafts")
            .ReplaceOneAsync(d => d.Id == draft.Id, draft, new ReplaceOptions { IsUpsert = true }, ct);
    }
}
