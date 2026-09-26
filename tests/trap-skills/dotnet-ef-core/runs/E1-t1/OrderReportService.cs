namespace Shop.Data;

public sealed record OrderSummary(Guid Id, string CustomerName, decimal Total, int ItemsCount);

public sealed record OverdueOrderSummary(Guid Id, string CustomerName, DateTime CreatedAt, decimal Total);

public class OrderReportService
{
    private const string ActiveStatus = "active";

    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<OrderSummary>> GetActiveOrdersAsync() =>
        _orders.QueryReadOnly()
            .Where(o => o.Status == ActiveStatus)
            .Select(o => new OrderSummary(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync() =>
        _orders.QueryReadOnly()
            .Where(o => o.Status == ActiveStatus)
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count);

    public Task<List<OverdueOrderSummary>> GetOverdueOrdersAsync(DateTime now)
    {
        // CreatedAt - "timestamp without time zone": Npgsql 6+ отвергает Kind=Utc для этой колонки (npgsql.org/doc/types/datetime.html)
        if (now.Kind == DateTimeKind.Utc)
            throw new ArgumentException($"{nameof(now)} must have DateTimeKind.Unspecified or Local, got Utc", nameof(now));

        // Order.IsOverdue инлайнится вручную: как client-eval предикат в Where() он бросил бы InvalidOperationException при трансляции (EF Core 3.x+)
        return _orders.QueryReadOnly()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < now)
            .Select(o => new OverdueOrderSummary(o.Id, o.Customer.Name, o.CreatedAt, o.Total))
            .ToListAsync();
    }
}
