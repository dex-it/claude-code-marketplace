using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // AsNoTracking: consumed read-only by OrderReportService.
    public IQueryable<Order> QueryActive() => _db.Orders.AsNoTracking().Where(o => o.Status == "active");

    public IQueryable<Order> QueryAll() => _db.Orders.AsNoTracking();
}
