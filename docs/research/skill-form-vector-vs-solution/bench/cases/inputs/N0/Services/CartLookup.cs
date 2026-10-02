using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public record CartLine(Guid Id, string Sku, decimal Price, int Stock);

public class CartLookup
{
    private readonly ShopDbContext _db;
    public CartLookup(ShopDbContext db) => _db = db;

    public Task<List<CartLine>> GetAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct = default)
    {
        var ids = productIds.Distinct().ToArray();
        return _db.Products
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new CartLine(p.Id, p.Sku, p.Price, p.Stock))
            .ToListAsync(ct);
    }
}
