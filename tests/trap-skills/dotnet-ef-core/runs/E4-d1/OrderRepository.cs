namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    public async Task ClearItemsAsync(Guid orderId)
    {
        var order = await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return;
        order.Items.Clear();
        await _db.SaveChangesAsync();
    }
}
