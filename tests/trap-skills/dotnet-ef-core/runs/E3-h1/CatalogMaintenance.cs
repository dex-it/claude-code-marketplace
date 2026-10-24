namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;
    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate: set-based UPDATE, no entity load/tracking, one roundtrip.
    public Task<int> RaisePricesByCategoryAsync(string category, decimal factor = 1.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * factor), ct);

    // ~40M/~50M rows: one ExecuteDelete = one long transaction blocking autovacuum reclaim for the whole run, batch+commit instead.
    public async Task<long> CleanupOldAuditLogsAsync(
        TimeSpan retention,
        int batchSize = 5_000,
        TimeSpan delayBetweenBatches = default,
        CancellationToken ct = default)
    {
        // At maps to timestamptz by convention; Npgsql 6+ requires Kind=Utc or it throws, UtcNow-TimeSpan keeps Kind=Utc.
        var cutoff = DateTime.UtcNow - retention;
        long totalDeleted = 0;

        while (true)
        {
            ct.ThrowIfCancellationRequested();

            // Select+Take, then delete by id set - avoids relying on ExecuteDelete's own OrderBy/Take translation.
            var batchIds = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Select(a => a.Id)
                .Take(batchSize)
                .ToListAsync(ct);

            if (batchIds.Count == 0)
                break;

            totalDeleted += await _db.AuditLogs
                .Where(a => batchIds.Contains(a.Id))
                .ExecuteDeleteAsync(ct);

            if (delayBetweenBatches > TimeSpan.Zero)
                await Task.Delay(delayBetweenBatches, ct);
        }

        return totalDeleted;
    }

    // Tracked on purpose: this is a write path, Stock is mutated below and persisted via SaveChanges.
    public async Task<int> RestockAsync(IEnumerable<(Guid Id, int Add)> deltas, CancellationToken ct = default)
    {
        var addById = new Dictionary<Guid, int>();
        foreach (var (id, add) in deltas)
            addById[id] = addById.TryGetValue(id, out var existing) ? existing + add : add;

        if (addById.Count == 0)
            return 0;

        var ids = addById.Keys.ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var product in products)
            product.Stock += addById[product.Id];

        return await _db.SaveChangesAsync(ct);
    }

    public async Task<Product> CreateProductAsync(
        string sku,
        string warehouse,
        string category,
        decimal price,
        int stock,
        CancellationToken ct = default)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Warehouse = warehouse,
            Category = category,
            Price = price,
            Stock = stock
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return product;
    }
}
