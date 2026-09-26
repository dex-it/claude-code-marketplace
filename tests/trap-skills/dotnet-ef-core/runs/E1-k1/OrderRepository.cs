namespace Shop.Data;

public class OrderRepository
{
    // единственное определение "активного" статуса - остальной код ссылается сюда, не на литерал
    public const string ActiveStatus = "active";

    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // DTO-проекция минует Change Tracker и lazy-load virtual Customer
    public Task<List<OrderSummary>> GetActiveOrderSummariesAsync(CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .Select(o => new OrderSummary(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);

    // ToDictionaryAsync - Func, не Expression: считается над уже агрегированными GroupBy-строками
    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync(CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == ActiveStatus)
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count, ct);

    // Order.IsOverdue как метод EF Core в Where не транслирует - правило продублировано выражением
    public Task<List<OrderSummary>> GetOverdueOrdersAsync(DateTime now, CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < now)
            .Select(o => new OrderSummary(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync(ct);
}
