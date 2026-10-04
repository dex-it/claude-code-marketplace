using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public record OrderCardDto(Guid Id, string Customer, decimal Total, IReadOnlyList<OrderItem> Items, IReadOnlyList<Payment> Payments);

public class OrderCard
{
    private readonly ShopDbContext _db;
    public OrderCard(ShopDbContext db) => _db = db;

    // Карточка одного заказа: позиции и платежи - две коллекции одного уровня.
    public async Task<OrderCardDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .SingleOrDefaultAsync(o => o.Id == id, ct);

        return order is null
            ? null
            : new OrderCardDto(order.Id, order.Customer.Name, order.Total, order.Items, order.Payments);
    }
}
