namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Убирает все позиции заказа. Items нужно загрузить трекингом (не AsNoTracking),
    // чтобы Clear() позволил change tracker'у удалить осиротевшие OrderItem
    // (см. DeleteBehavior.ClientCascade в OnModelCreating).
    public async Task ClearItemsAsync(Guid orderId)
    {
        var order = await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) return;

        order.Items.Clear();
        await _db.SaveChangesAsync();
    }
}
