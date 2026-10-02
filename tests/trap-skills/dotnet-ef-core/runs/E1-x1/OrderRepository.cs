namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Read-only, untracked base query for reporting/read-only scenarios.
    // Callers compose further filtering/projection on top; the Order.HasQueryFilter
    // (soft-delete) still applies automatically.
    public IQueryable<Order> QueryAsNoTracking() => _db.Orders.AsNoTracking();
}
