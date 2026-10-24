using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    /// <summary>Убирает все позиции из заказа и сохраняет изменения.</summary>
    public async Task ClearItemsAsync(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order is null) return;

        // DeleteBehavior.ClientCascade на Order->Items гарантирует, что удалённые из коллекции
        // позиции будут удалены EF при SaveChanges, без исключения о разрыве required-связи.
        order.Items.Clear();

        await _db.SaveChangesAsync();
    }
}
