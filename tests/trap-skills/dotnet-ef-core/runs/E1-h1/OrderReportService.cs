using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public record OrderSummaryDto(Guid Id, string CustomerName, decimal Total, int ItemsCount);

public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    public Task<List<OrderSummaryDto>> GetActiveOrdersAsync() =>
        _orders.QueryActive()
            .Select(o => new OrderSummaryDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();

    public async Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync()
    {
        var counts = await _orders.QueryActive()
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToListAsync();
        return counts.ToDictionary(x => x.Category, x => x.Count);
    }

    public Task<List<OrderSummaryDto>> GetOverdueOrdersAsync(DateTime now)
    {
        // now must be Unspecified to match CreatedAt's "timestamp without time zone" mapping (Npgsql 6+ throws on Kind mismatch).
        var cutoffNow = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
        return _orders.QueryAll()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < cutoffNow)
            .Select(o => new OrderSummaryDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();
    }
}
