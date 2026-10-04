using Microsoft.EntityFrameworkCore;

namespace Shop;

public class OrderConfirmation
{
    private readonly ShopDbContext _db;
    public OrderConfirmation(ShopDbContext db) => _db = db;

    // Ночной job: подтверждает новые заказы незаблокированных клиентов.
    public async Task ConfirmPending(CancellationToken ct = default)
    {
        var pending = await _db.Orders.Where(o => o.Status == "New").ToListAsync(ct);

        foreach (var order in pending)
        {
            var customer = await _db.Customers.FindAsync(new object[] { order.CustomerId }, ct);
            if (customer is null || customer.IsBlocked)
                continue;

            order.Status = "Confirmed";
        }

        await _db.SaveChangesAsync(ct);
    }
}
