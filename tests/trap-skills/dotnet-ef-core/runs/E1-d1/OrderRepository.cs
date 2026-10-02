using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private const string ActiveStatus = "active";

    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    public Task<List<OrderSummaryDto>> GetActiveSummariesAsync(CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .Select(o => new OrderSummaryDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);

    public async Task<Dictionary<string, int>> GetActiveCountsByCategoryAsync(CancellationToken ct = default)
    {
        var rows = await _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Category, r => r.Count);
    }

    public Task<List<OrderSummaryDto>> GetOverdueAsync(DateTime now, CancellationToken ct = default)
    {
        // Npgsql 6+ rejects Kind=Utc for a "timestamp without time zone" column.
        var overdueBefore = DateTime.SpecifyKind(now, DateTimeKind.Unspecified).AddDays(-3);
        var query = _db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < overdueBefore);
        // Not o.IsOverdue(now): non-projection method calls don't translate in EF Core 3+.
        return query
            .Select(o => new OrderSummaryDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);
    }
}
