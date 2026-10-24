using Npgsql;

namespace Shop.Data.Services;

public class CatalogService
{
    private readonly ShopDbContext _db;
    public CatalogService(ShopDbContext db) => _db = db;

    public async Task<bool> Reserve(Guid productId, int qty)
    {
        var product = await _db.Products
            .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId)
            .SingleAsync();
        if (product.Stock < qty) return false;
        product.Stock -= qty;
        await _db.SaveChangesAsync();
        return true;
    }

    public Task<List<Product>> Search(string? category, decimal? minPrice)
    {
        const string template = "SELECT * FROM \"Products\" p WHERE {0}";
        var conditions = new List<string> { "TRUE" };
        var args = new List<object>();
        if (category != null)
        {
            conditions.Add($"\"Products\".\"Category\" = @p{args.Count}");
            args.Add(new NpgsqlParameter($"p{args.Count}", category));
        }
        if (minPrice != null)
        {
            conditions.Add($"\"Products\".\"Price\" >= @p{args.Count}");
            args.Add(new NpgsqlParameter($"p{args.Count}", minPrice));
        }
        var sql = string.Format(template, string.Join(" AND ", conditions));
        return _db.Products.FromSqlRaw(sql, args.ToArray()).AsNoTracking().ToListAsync();
    }

    public async Task Reprice(string category, decimal factor)
    {
        var products = await _db.Products.Where(p => p.Category == category).ToListAsync();
        foreach (var p in products) p.Price *= factor;
        _db.UpdateRange(products);
        await _db.SaveChangesAsync();
    }
}
