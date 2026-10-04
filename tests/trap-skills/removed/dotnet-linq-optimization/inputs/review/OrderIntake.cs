using Microsoft.EntityFrameworkCore;

namespace Shop;

public class OrderIntake
{
    private readonly ShopDbContext _db;
    public OrderIntake(ShopDbContext db) => _db = db;

    public IEnumerable<OrderItem> ItemsOf(Guid orderId) =>
        _db.OrderItems.Where(i => i.OrderId == orderId).AsEnumerable();

    public async Task Accept(Guid orderId, CancellationToken ct = default)
    {
        var order = await _db.Orders.SingleAsync(o => o.Id == orderId, ct);
        var items = ItemsOf(orderId);

        if (!items.Any())
            throw new InvalidOperationException($"Order {orderId} has no items");

        if (items.Count() > 50)
        {
            order.Status = "Rejected";
            await _db.SaveChangesAsync(ct);
            return;
        }

        order.Total = items.Sum(i => i.Qty * i.Price);
        order.Status = "Accepted";
        await _db.SaveChangesAsync(ct);
    }
}
