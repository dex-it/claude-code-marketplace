using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;

    // Только чтение - без трекинга.
    public Task<List<Order>> GetAllAsync() => _db.Orders.AsNoTracking().ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);

    // Убрать все позиции из заказа и сохранить. Заказ мягко удаляемый (HasQueryFilter),
    // поэтому запрос по умолчанию не видит уже удалённые заказы. Items - required FK,
    // поэтому очистка коллекции приводит к удалению осиротевших OrderItem при SaveChanges.
    public async Task ClearItems(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return;

        order.Items.Clear();
        await _db.SaveChangesAsync();
    }
}
