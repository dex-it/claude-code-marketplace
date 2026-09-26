namespace Shop.Data;

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<OrderSummaryDto>> GetActiveOrdersAsync(CancellationToken ct = default) =>
        _orders.GetActiveOrderSummariesAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync(CancellationToken ct = default) =>
        _orders.GetActiveOrderCountByCategoryAsync(ct);

    // now в шкале Order.CreatedAt (Kind Unspecified/Local) - UtcNow репозиторий отвергнет.
    public Task<List<OrderSummaryDto>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        _orders.GetOverdueOrdersAsync(now, ct);
}
