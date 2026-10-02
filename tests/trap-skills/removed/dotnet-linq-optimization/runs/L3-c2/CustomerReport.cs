using Microsoft.EntityFrameworkCore;

namespace Shop;

public sealed record CustomerOrderSummary(Guid Id, DateTime CreatedAt, decimal Total);

public sealed record CustomerOrdersReport(
    string Email,
    int OrdersCount,
    decimal TotalAmount,
    List<CustomerOrderSummary> Orders);

public static class CustomerReport
{
    // [from, to): верхняя граница исключена, чтобы соседние периоды не пересекались по стыку.
    public static async Task<List<CustomerOrdersReport>> Build(
        ShopDbContext db,
        DateTime from,
        DateTime to,
        CancellationToken ct = default)
    {
        var orders = await db.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= from && o.CreatedAt < to)
            .OrderBy(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.CreatedAt,
                o.Total,
                o.CustomerId,
                Email = o.Customer.Email
            })
            .ToListAsync(ct);

        return orders
            .GroupBy(o => new { o.CustomerId, o.Email })
            .Select(g => new CustomerOrdersReport(
                g.Key.Email,
                g.Count(),
                g.Sum(o => o.Total),
                g.Select(o => new CustomerOrderSummary(o.Id, o.CreatedAt, o.Total)).ToList()))
            .OrderBy(r => r.Email)
            .ToList();
    }
}
