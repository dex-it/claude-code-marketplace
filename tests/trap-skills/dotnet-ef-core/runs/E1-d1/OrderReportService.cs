namespace Shop.Data;

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<OrderSummaryDto>> GetActiveOrdersAsync(CancellationToken ct = default) =>
        _orders.GetActiveSummariesAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync(CancellationToken ct = default) =>
        _orders.GetActiveCountsByCategoryAsync(ct);

    public Task<List<OrderSummaryDto>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        _orders.GetOverdueAsync(now, ct);
}
