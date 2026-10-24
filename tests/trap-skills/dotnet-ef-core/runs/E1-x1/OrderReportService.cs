namespace Shop.Data;

// Row shape used for the orders report page (active orders list, overdue orders list).
public record OrderReportRow(Guid OrderId, string CustomerName, decimal Total, int ItemsCount);

// Read-only report queries for the orders report page. Backed by OrderRepository's
// no-tracking query so nothing here creates change-tracked entities.
public class OrderReportService
{
    private const string ActiveStatus = "active";

    private readonly OrderRepository _orders;

    public OrderReportService(OrderRepository orders) => _orders = orders;

    // (a) Active orders: id, customer name, total, number of items.
    public Task<List<OrderReportRow>> GetActiveOrdersAsync() =>
        _orders.QueryAsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .Select(o => new OrderReportRow(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();

    // (b) Number of active orders per category.
    public async Task<Dictionary<string, int>> GetActiveOrderCountByCategoryAsync()
    {
        var counts = await _orders.QueryAsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToListAsync();

        return counts.ToDictionary(c => c.Category, c => c.Count);
    }

    // (c) Orders overdue as of `now`, per the Order.IsOverdue rule.
    public Task<List<OrderReportRow>> GetOverdueOrdersAsync(DateTime now)
    {
        // Order.CreatedAt is mapped to "timestamp without time zone", so Npgsql
        // requires the compared value to be DateTime.Kind == Unspecified (a Utc
        // or Local value is rejected when the parameter is written). Normalize
        // here regardless of what Kind the caller passed.
        var asOf = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);

        // IsOverdue's body is inlined rather than calling o.IsOverdue(now):
        // an instance method call on the entity isn't translatable to SQL.
        return _orders.QueryAsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < asOf)
            .Select(o => new OrderReportRow(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();
    }
}
