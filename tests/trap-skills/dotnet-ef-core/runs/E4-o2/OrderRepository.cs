namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Убирает все позиции заказа. Явно удаляем строки OrderItem (а не Order.Items.Clear()):
    // OrderId — required FK, а связь Order->Items настроена с DeleteBehavior.Restrict,
    // поэтому "открепление" через навигацию упало бы/повело бы себя непредсказуемо.
    // Здесь же удаляются именно позиции, без затрагивания самого Order.
    public async Task ClearItemsAsync(Guid orderId)
    {
        var items = await _db.Set<OrderItem>()
            .Where(i => i.OrderId == orderId)
            .ToListAsync();

        _db.RemoveRange(items);
        await _db.SaveChangesAsync();
    }
}
