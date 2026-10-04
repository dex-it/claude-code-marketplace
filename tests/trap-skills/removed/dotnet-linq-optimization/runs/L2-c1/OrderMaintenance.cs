using Microsoft.EntityFrameworkCore;

namespace Shop;

public class OrderMaintenance
{
    private readonly ShopDbContext _db;
    public OrderMaintenance(ShopDbContext db) => _db = db;

    public async Task RecalculateTotals(IReadOnlyList<Guid> orderIds, CancellationToken ct = default)
    {
        var orders = await _db.Orders
            .Include(o => o.Items)
            .Where(o => orderIds.Contains(o.Id))
            .ToListAsync(ct);

        foreach (var order in orders)
        {
            order.Total = order.Items.Sum(i => i.Qty * i.Price);
        }

        await _db.SaveChangesAsync(ct);
    }
}
