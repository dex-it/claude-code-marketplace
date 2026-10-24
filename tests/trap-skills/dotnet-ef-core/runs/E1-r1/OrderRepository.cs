namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Отчётная выборка: AsNoTracking, Change Tracker снимку не нужен.
    public IQueryable<Order> QueryActive() =>
        _db.Orders.AsNoTracking().Where(o => o.Status == "active");

    public IQueryable<Order> QueryOverdue(DateTime asOf)
    {
        // IsOverdue не транслируется EF; условие переписано через AddDays (-> SQL INTERVAL).
        var point = DateTime.SpecifyKind(asOf, DateTimeKind.Unspecified); // Npgsql: колонке нужен Kind Unspecified
        return _db.Orders.AsNoTracking().Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < point);
    }
}
