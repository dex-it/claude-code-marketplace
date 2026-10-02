namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Include + Clear на required-навигации удаляет строки в SaveChanges сам EF (ClientCascade).
    public async Task ClearItemsAsync(Guid orderId)
    {
        var order = await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Order {orderId} not found");
        order.Items.Clear();
        await _db.SaveChangesAsync();
    }
}
