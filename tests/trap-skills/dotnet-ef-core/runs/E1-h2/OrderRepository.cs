namespace Shop.Data;

public class OrderRepository
{
    private const string ActiveStatus = "active";

    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    public Task<List<OrderSummaryDto>> GetActiveOrderSummariesAsync(CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .Select(o => new OrderSummaryDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);

    public Task<Dictionary<string, int>> GetActiveOrderCountByCategoryAsync(CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count, ct);

    // o.IsOverdue(now) не транслируется в SQL - условие инлайнено вручную.
    public Task<List<OrderSummaryDto>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default)
    {
        // CreatedAt хранится без tz - Kind=Utc молча сравнил бы с чужой шкалой, падаем явно.
        if (now.Kind == DateTimeKind.Utc)
            throw new ArgumentException("now должен быть той же шкалой, что и Order.CreatedAt (Kind Unspecified/Local), не UTC", nameof(now));

        return _db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < now)
            .Select(o => new OrderSummaryDto(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);
    }
}
