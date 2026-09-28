using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public record OrderRow(Guid Id, DateTime CreatedAt, decimal Total, string Status);

public class CustomerOrders
{
    private readonly ShopDbContext _db;
    public CustomerOrders(ShopDbContext db) => _db = db;

    // page - номер страницы с 1, как в MR.
    public Task<List<OrderRow>> ActivePageAsync(Guid customerId, int page, int pageSize, CancellationToken ct = default)
    {
        return _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.Status == "Active")
            .OrderByDescending(o => o.CreatedAt)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(o => new OrderRow(o.Id, o.CreatedAt, o.Total, o.Status))
            .ToListAsync(ct);
    }
}
