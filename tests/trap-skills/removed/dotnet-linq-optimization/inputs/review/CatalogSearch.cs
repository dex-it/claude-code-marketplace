using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;

namespace Shop;

public record ProductCard(Guid Id, string Name, decimal Price);

public class CatalogSearch
{
    private static readonly Expression<Func<Product, ProductCard>> Card =
        p => new ProductCard(p.Id, p.Name, p.Price);

    private readonly ShopDbContext _db;
    public CatalogSearch(ShopDbContext db) => _db = db;

    public async Task<List<ProductCard>> Search(string? category, decimal? maxPrice, CancellationToken ct = default)
    {
        if (category != null && maxPrice != null)
            return await _db.Products.AsNoTracking()
                .Where(p => p.IsActive && p.Category == category && p.Price <= maxPrice)
                .Select(Card).ToListAsync(ct);

        if (category != null)
            return await _db.Products.AsNoTracking()
                .Where(p => p.IsActive && p.Category == category)
                .Select(Card).ToListAsync(ct);

        if (maxPrice != null)
            return await _db.Products.AsNoTracking()
                .Where(p => p.IsActive && p.Price <= maxPrice)
                .Select(Card).ToListAsync(ct);

        return await _db.Products.AsNoTracking()
            .Where(p => p.IsActive)
            .Select(Card).ToListAsync(ct);
    }
}
