using Microsoft.EntityFrameworkCore;

namespace Shop;

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    public Task<List<Product>> GetAllAsync(CancellationToken ct = default) =>
        _db.Products.ToListAsync(ct);

    public Task<Product?> GetAsync(Guid id, CancellationToken ct = default) =>
        _db.Products.FindAsync(new object[] { id }, ct).AsTask();
}
