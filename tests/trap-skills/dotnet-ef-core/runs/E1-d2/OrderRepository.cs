namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    public IQueryable<Order> ActiveOrders() => _db.Orders.AsNoTracking().Where(o => o.Status == "active");

    public Task<List<Order>> GetOverdueAsync(DateTime now)
    {
        // Inlined IsOverdue; Kind stripped since Npgsql rejects Utc for tz-less timestamp columns.
        var asOf = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
        return _db.Orders.AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < asOf)
            .ToListAsync();
    }
}
