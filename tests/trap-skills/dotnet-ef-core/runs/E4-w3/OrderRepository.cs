using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Убрать все позиции из заказа и сохранить. Items нужно явно подгрузить (Include),
    // иначе Clear() очистит только пустую in-memory коллекцию и ничего не удалит в БД.
    // FK Order->Items required (OnDelete Restrict на удаление самого Order), но при удалении
    // элемента из коллекции состоявшегося (persisted) Order EF всё равно помечает
    // осиротевшие OrderItem на удаление (Deleted), т.к. FK не может стать NULL.
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
