namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Projection (not Include) keeps Items.Count a scalar subquery, avoiding a row-duplicating join.
    public Task<List<OrderSummary>> GetActiveSummariesAsync(CancellationToken ct = default) =>
        _db.Orders.AsNoTracking()
            .Where(o => o.Status == "active")
            .Select(o => new OrderSummary(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);

    // Select before ToDictionaryAsync: otherwise the source is IGrouping<string, Order> and EF loads every row per group.
    public Task<Dictionary<string, int>> GetActiveCategoryCountsAsync(CancellationToken ct = default) =>
        _db.Orders.AsNoTracking()
            .Where(o => o.Status == "active")
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count, ct);

    /// <summary>
    /// Overdue orders per <see cref="Order.IsOverdue"/> as of <paramref name="now"/>.
    /// </summary>
    /// <param name="now">
    /// Kind must be Local or Unspecified to match <see cref="Order.CreatedAt"/>'s "timestamp
    /// without time zone" column - Npgsql 6+ maps Kind=Utc to timestamptz and throws on comparison
    /// against a "without time zone" column. A Utc value here is reinterpreted, not converted.
    /// </param>
    public Task<List<OrderSummary>> GetOverdueSummariesAsync(DateTime now, CancellationToken ct = default)
    {
        var cutoffNow = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
        return _db.Orders.AsNoTracking()
            // Inlined Order.IsOverdue's body: o.IsOverdue(now) is a method call EF cannot translate to SQL.
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < cutoffNow)
            .Select(o => new OrderSummary(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);
    }
}

public record OrderSummary(Guid Id, string CustomerName, decimal Total, int ItemsCount);
