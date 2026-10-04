// Shop.Data - EF Core 8, PostgreSQL (Npgsql.EntityFrameworkCore.PostgreSQL 8)
using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdateAsync computes Price server-side in one UPDATE - no entity load, no read-then-write race between concurrent callers.
    public Task<int> RaisePricesByPercentAsync(string category, decimal percent = 0.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percent)), ct);

    // ExecuteDelete has no OrderBy/Take support (EF docs, "limitations"); paginate by id in page-sized batches instead of one DELETE outbloating autovacuum.
    public async Task<long> PurgeOldAuditLogsAsync(
        int batchSize = 5000,
        TimeSpan? pauseBetweenBatches = null,
        CancellationToken ct = default)
    {
        // AuditLog.At has no HasColumnType override, so Npgsql 6+ maps it to timestamptz by default and requires Kind=Utc (npgsql.org/doc/types/datetime.html).
        var cutoff = DateTime.UtcNow.AddYears(-1);
        var pause = pauseBetweenBatches ?? TimeSpan.FromMilliseconds(50);

        long totalDeleted = 0;
        long lastId = 0;
        int fetched;
        do
        {
            var ids = await _db.AuditLogs
                .Where(a => a.At < cutoff && a.Id > lastId)
                .OrderBy(a => a.Id)
                .Select(a => a.Id)
                .Take(batchSize)
                .ToListAsync(ct);

            fetched = ids.Count;
            if (fetched == 0) break;

            await _db.AuditLogs
                .Where(a => ids.Contains(a.Id))
                .ExecuteDeleteAsync(ct);

            totalDeleted += fetched;
            lastId = ids[^1];

            // Pause gives autovacuum and concurrent traffic room between batches during the nightly run.
            if (fetched == batchSize && pause > TimeSpan.Zero)
                await Task.Delay(pause, ct);
        } while (fetched == batchSize);

        return totalDeleted;
    }

    // Single Where(id => ids.Contains(...)) round trip instead of one query per id (N+1); duplicate ids in deltas are summed first.
    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> deltas, CancellationToken ct = default)
    {
        var byId = new Dictionary<Guid, int>();
        foreach (var (id, add) in deltas)
            byId[id] = byId.GetValueOrDefault(id) + add;

        if (byId.Count == 0)
            return;

        var ids = byId.Keys.ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var product in products)
            product.Stock += byId[product.Id];

        await _db.SaveChangesAsync(ct);
    }

    // Client-generated id (vs DB-generated) so the caller can reference the new product before SaveChanges completes.
    public async Task<Product> CreateProductAsync(
        string sku,
        string category,
        string warehouse,
        decimal price,
        int stock = 0,
        CancellationToken ct = default)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Category = category,
            Warehouse = warehouse,
            Price = price,
            Stock = stock,
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return product;
    }
}
