namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Убирает все позиции (Items) из заказа и сохраняет изменения.
    // Items — обязательная (не nullable FK) зависимая коллекция, поэтому очистка
    // навигационного свойства приводит к удалению соответствующих строк OrderItem.
    public async Task ClearItemsAsync(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order is null)
            throw new InvalidOperationException($"Order '{orderId}' not found.");

        order.Items.Clear();
        await _db.SaveChangesAsync();
    }
}
