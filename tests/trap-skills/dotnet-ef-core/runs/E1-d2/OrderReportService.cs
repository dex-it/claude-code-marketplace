namespace Shop.Data;

public record ActiveOrderReportRow(Guid OrderId, string CustomerName, decimal Total, int ItemsCount);

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<ActiveOrderReportRow>> GetActiveOrdersAsync() =>
        _orders.ActiveOrders()
            .OrderBy(o => o.CreatedAt)
            .Select(o => new ActiveOrderReportRow(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();

    public Task<Dictionary<string, int>> GetActiveOrderCountByCategoryAsync() =>
        _orders.ActiveOrders()
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count);

    public Task<List<Order>> GetOverdueOrdersAsync(DateTime now) => _orders.GetOverdueAsync(now);
}
