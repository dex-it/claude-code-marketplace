using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class CatalogMaintenance
{
    // Batched so a ~40M-row purge never sits behind one long DELETE transaction/lock.
    private const int AuditLogPurgeBatchSize = 10_000;

    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate: bulk price change without loading/tracking every Product of the category.
    public Task<int> RaisePricesAsync(string category, decimal factor = 1.1m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * factor), ct);

    // No ORDER BY: deleted rows leave the WHERE-set on their own, no OFFSET-style paging needed.
    public async Task<long> PurgeOldAuditLogsAsync(CancellationToken ct = default)
    {
        // At has no HasColumnType override -> Npgsql default maps it to timestamptz, which requires Kind=Utc.
        var cutoff = DateTime.UtcNow.AddYears(-1);
        long totalDeleted = 0;

        while (!ct.IsCancellationRequested)
        {
            var batchIds = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .Select(a => a.Id)
                .Take(AuditLogPurgeBatchSize)
                .ToListAsync(ct);

            if (batchIds.Count == 0)
                break;

            totalDeleted += await _db.AuditLogs
                .Where(a => batchIds.Contains(a.Id))
                .ExecuteDeleteAsync(ct);
        }

        return totalDeleted;
    }

    // Single round trip for all requested ids, then one SaveChangesAsync - avoids per-id N+1 queries.
    public async Task RestockAsync(IEnumerable<(Guid id, int add)> deltas, CancellationToken ct = default)
    {
        var deltaList = deltas.ToList();
        if (deltaList.Count == 0)
            return;

        var ids = deltaList.Select(d => d.id).ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var (id, add) in deltaList)
        {
            if (products.TryGetValue(id, out var product))
                product.Stock += add;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task<Product> CreateProductAsync(
        string sku, string warehouse, string category, decimal price, int stock = 0, CancellationToken ct = default)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Warehouse = warehouse,
            Category = category,
            Price = price,
            Stock = stock,
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return product;
    }
}
