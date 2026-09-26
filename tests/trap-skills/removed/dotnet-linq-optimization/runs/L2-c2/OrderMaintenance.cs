using Microsoft.EntityFrameworkCore;

namespace Shop;

public class OrderMaintenance
{
    private readonly ShopDbContext _db;
    public OrderMaintenance(ShopDbContext db) => _db = db;

    public async Task RecalculateTotals(IReadOnlyList<Guid> orderIds, CancellationToken ct = default)
    {
        if (orderIds.Count == 0) return;

        var orders = await _db.Orders
            .Where(o => orderIds.Contains(o.Id))
            .Include(o => o.Items)
            .ToListAsync(ct);

        foreach (var order in orders)
            order.Total = order.Items.Sum(i => i.Qty * i.Price);

        await _db.SaveChangesAsync(ct);
    }
}
