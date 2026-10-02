namespace Shop.Data;

public record ActiveOrderDto(Guid Id, string CustomerName, decimal Total, int ItemsCount);

public record OverdueOrderDto(Guid Id, string CustomerName, DateTime CreatedAt, decimal Total);

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<ActiveOrderDto>> GetActiveOrdersAsync() =>
        _orders.QueryReadOnly()
            .Where(o => o.Status == "active")
            .Select(o => new ActiveOrderDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();

    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync() =>
        _orders.QueryReadOnly()
            .Where(o => o.Status == "active")
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count);

    public Task<List<OverdueOrderDto>> GetOverdueOrdersAsync(DateTime now)
    {
        // IsOverdue не транслируется как метод модели внутри Where - правило развёрнуто вручную.
        var asOf = DateTime.SpecifyKind(now, DateTimeKind.Unspecified); // timestamp without time zone принимает Kind Unspecified/Local, не Utc
        return _orders.QueryReadOnly()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < asOf)
            .Select(o => new OverdueOrderDto(o.Id, o.Customer.Name, o.CreatedAt, o.Total))
            .ToListAsync();
    }
}
