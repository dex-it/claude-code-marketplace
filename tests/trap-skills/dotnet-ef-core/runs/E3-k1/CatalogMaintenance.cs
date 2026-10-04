namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // Set-based UPDATE (ExecuteUpdateAsync, EF Core 7+) - avoids loading/tracking every product in the category just to bump Price.
    public Task<int> RaisePricesAsync(string category, decimal percent = 10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percent / 100m)), ct);

    // Batched: one ExecuteDelete over all ~40M rows would run as a single long transaction, blocking autovacuum on the dead tuples it produces until commit.
    public async Task<long> PurgeOldAuditLogsAsync(
        TimeSpan retention,
        int batchSize = 10_000,
        TimeSpan? delayBetweenBatches = null,
        CancellationToken ct = default)
    {
        // AuditLog.At has no HasColumnType override -> maps to timestamptz, which only accepts Kind=Utc (Npgsql 6+ throws on Local/Unspecified).
        var cutoff = DateTime.UtcNow - retention;
        var delay = delayBetweenBatches ?? TimeSpan.FromMilliseconds(50);
        long totalDeleted = 0;

        while (!ct.IsCancellationRequested)
        {
            // Scalar Select(a => a.Id), not an entity query - never enters the change tracker regardless of tracking mode.
            var batchIds = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Select(a => a.Id)
                .Take(batchSize)
                .ToListAsync(ct);

            if (batchIds.Count == 0) break;

            var deleted = await _db.AuditLogs
                .Where(a => batchIds.Contains(a.Id))
                .ExecuteDeleteAsync(ct);

            totalDeleted += deleted;

            if (delay > TimeSpan.Zero)
                await Task.Delay(delay, ct);
        }

        return totalDeleted;
    }

    // Contains() -> single WHERE ... = ANY(...) instead of one query per id.
    public async Task RestockAsync(IEnumerable<(Guid id, int add)> deltas, CancellationToken ct = default)
    {
        var deltaList = deltas as ICollection<(Guid id, int add)> ?? deltas.ToList();
        if (deltaList.Count == 0) return;

        var ids = deltaList.Select(d => d.id).Distinct().ToList();
        // ToListAsync(), not ToDictionaryAsync(): entities from ToDictionaryAsync bypass the change tracker (dotnet/efcore#25158), so Stock += add would silently not persist.
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);
        var byId = products.ToDictionary(p => p.Id);

        var missing = new List<Guid>();
        foreach (var (id, add) in deltaList)
        {
            if (byId.TryGetValue(id, out var product))
                product.Stock += add;
            else
                missing.Add(id);
        }

        if (missing.Count > 0)
            throw new InvalidOperationException($"Restock: unknown product id(s): {string.Join(", ", missing.Distinct())}");

        await _db.SaveChangesAsync(ct);
    }

    public async Task<Product> CreateProductAsync(
        string sku,
        string warehouse,
        string category,
        decimal price,
        int stock = 0,
        CancellationToken ct = default)
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
