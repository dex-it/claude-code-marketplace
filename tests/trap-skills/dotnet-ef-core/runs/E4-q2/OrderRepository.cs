using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Убирает все позиции (OrderItem) заказа и сохраняет изменения.
    // FK OrderItem.OrderId обязательный, поэтому Remove здесь означает реальное удаление строк,
    // а не отвязку от заказа (см. комментарий про OnDelete в ShopDbContext.OnModelCreating).
    // Работаем напрямую с DbSet<OrderItem>, не подгружая сам Order с его Items:
    // это не задевает soft-delete query filter заказа (он есть только на Order) и не тянет лишний граф.
    public async Task ClearItemsAsync(Guid orderId)
    {
        var items = await _db.Set<OrderItem>()
            .Where(i => i.OrderId == orderId)
            .ToListAsync();

        _db.Set<OrderItem>().RemoveRange(items);
        await _db.SaveChangesAsync();
    }
}
