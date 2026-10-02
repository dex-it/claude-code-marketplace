namespace Shop.Data;

// Read-only report queries live in OrderRepository; this is a thin facade named for the report page.
public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<OrderSummary>> GetActiveOrdersAsync(CancellationToken ct = default) =>
        _orders.GetActiveSummariesAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync(CancellationToken ct = default) =>
        _orders.GetActiveCategoryCountsAsync(ct);

    public Task<List<OrderSummary>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        _orders.GetOverdueSummariesAsync(now, ct);
}
