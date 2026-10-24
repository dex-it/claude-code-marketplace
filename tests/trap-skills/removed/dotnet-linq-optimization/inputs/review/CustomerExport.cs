using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerExport
{
    private readonly ShopDbContext _db;
    public CustomerExport(ShopDbContext db) => _db = db;

    // Клиенты, делавшие заказы в периоде - выгрузка для CRM.
    public async Task<List<Customer>> CustomersWithOrders(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var orders = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Where(o => o.CreatedAt >= from && o.CreatedAt < to)
            .ToListAsync(ct);

        return orders
            .Select(o => o.Customer)
            .Distinct()
            .OrderBy(c => c.Email)
            .ToList();
    }

    public async Task<bool> HasOrders(Guid customerId, CancellationToken ct = default) =>
        await _db.Orders.CountAsync(o => o.CustomerId == customerId, ct) > 0;
}
