namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Убрать все позиции заказа и сохранить. Удаляем OrderItem-строки явно через DbSet
    // (RemoveRange), а не полагаемся на orphan-behavior навигации: FK Order->Items настроен
    // как Restrict (см. OnModelCreating), поэтому просто Items.Clear() без явного Remove
    // ЕF не удалит записи. Заказ, уже помеченный IsDeleted, глобальным query filter'ом
    // из выборки исключён — ClearItems для него вернётся как "не найден", ничего не делая.
    public async Task ClearItems(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return;

        _db.RemoveRange(order.Items);
        order.Items.Clear();
        await _db.SaveChangesAsync();
    }
}
