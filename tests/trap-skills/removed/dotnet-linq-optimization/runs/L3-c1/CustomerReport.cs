using Microsoft.EntityFrameworkCore;

namespace Shop;

public sealed record CustomerOrderInfo(Guid Id, DateTime CreatedAt, decimal Total);

public sealed record CustomerOrdersReport(
    string Email,
    int OrderCount,
    decimal TotalAmount,
    List<CustomerOrderInfo> Orders);

public class CustomerReport
{
    private readonly ShopDbContext _db;
    public CustomerReport(ShopDbContext db) => _db = db;

    // [from, to) - верхняя граница исключена, чтобы не зависеть от точности DateTime на стыке суток.
    public Task<List<CustomerOrdersReport>> Build(DateTime from, DateTime to, CancellationToken ct = default) =>
        _db.Customers
            .AsNoTracking()
            .Where(c => c.Orders.Any(o => o.CreatedAt >= from && o.CreatedAt < to))
            .Select(c => new CustomerOrdersReport(
                c.Email,
                c.Orders.Count(o => o.CreatedAt >= from && o.CreatedAt < to),
                c.Orders.Where(o => o.CreatedAt >= from && o.CreatedAt < to).Sum(o => o.Total),
                c.Orders
                    .Where(o => o.CreatedAt >= from && o.CreatedAt < to)
                    .Select(o => new CustomerOrderInfo(o.Id, o.CreatedAt, o.Total))
                    .ToList()))
            .ToListAsync(ct);
}
