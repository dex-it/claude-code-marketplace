namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // AsNoTracking - отчёты read-only, снимок в Change Tracker не нужен
    public IQueryable<Order> QueryReadOnly() => _db.Orders.AsNoTracking();
}
