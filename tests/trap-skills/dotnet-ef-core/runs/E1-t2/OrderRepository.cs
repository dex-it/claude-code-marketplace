namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Отчёт не изменяет данные - AsNoTracking, без снимков в Change Tracker.
    public IQueryable<Order> ActiveOrders() =>
        _db.Orders.AsNoTracking().Where(o => o.Status == "active");

    // Npgsql: Utc на "timestamp without time zone" бросает ArgumentException.
    public IQueryable<Order> OverdueOrders(DateTime now)
    {
        if (now.Kind == DateTimeKind.Utc)
            throw new ArgumentException("now: нужен Kind Unspecified или Local, не Utc", nameof(now));

        // Метод-правило o.IsOverdue(now) в SQL не транслируется - записано в транслируемом виде.
        return _db.Orders.AsNoTracking().Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < now);
    }
}
