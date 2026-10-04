namespace Shop.Data;

public sealed record ActiveOrderReportItem(Guid OrderId, string CustomerName, decimal Total, int ItemsCount);

public sealed record OverdueOrderReportItem(Guid OrderId, string CustomerName, decimal Total, DateTime CreatedAt);

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<ActiveOrderReportItem>> GetActiveOrdersAsync(CancellationToken ct = default) =>
        _orders.QueryActive()
            .Select(o => new ActiveOrderReportItem(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync(CancellationToken ct = default) =>
        _orders.QueryActive()
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count, ct);

    public Task<List<OverdueOrderReportItem>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        _orders.QueryOverdue(now)
            .Select(o => new OverdueOrderReportItem(o.Id, o.Customer.Name, o.Total, o.CreatedAt))
            .ToListAsync(ct);
}
