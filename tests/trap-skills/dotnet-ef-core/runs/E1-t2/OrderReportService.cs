namespace Shop.Data;

public sealed record ActiveOrderReportRow(Guid Id, string CustomerName, decimal Total, int ItemCount);

public sealed class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<ActiveOrderReportRow>> GetActiveOrdersAsync(CancellationToken ct = default) =>
        _orders.ActiveOrders()
            .Select(o => new ActiveOrderReportRow(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountByCategoryAsync(CancellationToken ct = default) =>
        _orders.ActiveOrders()
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count, ct);

    public Task<List<Order>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        _orders.OverdueOrders(now).ToListAsync(ct);
}
