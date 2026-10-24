namespace Shop.Data;

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<OrderSummary>> GetActiveOrdersAsync(CancellationToken ct = default) =>
        _orders.GetActiveOrderSummariesAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync(CancellationToken ct = default) =>
        _orders.GetActiveOrderCountsByCategoryAsync(ct);

    public Task<List<OrderSummary>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        // CreatedAt = "timestamp without time zone" => Npgsql 6+ требует Kind Unspecified/Local, Utc бросит на несовпадении с типом колонки
        _orders.GetOverdueOrdersAsync(DateTime.SpecifyKind(now, DateTimeKind.Unspecified), ct);
}
