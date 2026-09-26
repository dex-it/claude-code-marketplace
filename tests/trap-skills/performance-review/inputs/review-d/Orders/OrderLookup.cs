using Microsoft.EntityFrameworkCore;
using Shop.Api.Data;

namespace Shop.Api.Orders;

public sealed record OrderLineView(int Id, string Sku, int Quantity, decimal UnitPrice);
public sealed record OrderView(int Id, int CustomerId, DateTime CreatedAt, IReadOnlyList<OrderLineView> Lines);

public sealed class OrderLookup(ShopDbContext db)
{
    public Task<OrderView?> FindAsync(int tenantId, int orderId, CancellationToken ct) =>
        db.Orders
            .AsNoTracking()
            .Where(o => o.TenantId == tenantId && o.Id == orderId)
            .Select(o => new OrderView(
                o.Id,
                o.CustomerId,
                o.CreatedAt,
                o.Lines.Select(l => new OrderLineView(l.Id, l.Sku, l.Quantity, l.UnitPrice)).ToList()))
            .FirstOrDefaultAsync(ct);
}
