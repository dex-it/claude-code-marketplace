namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdateAsync: one set-based UPDATE, no per-row materialization into the Change Tracker.
    public Task<int> IncreasePricesByCategoryAsync(string category, decimal percent = 0.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percent)), ct);

    public async Task<long> CleanupOldAuditLogsAsync(
        TimeSpan? olderThan = null,
        int batchSize = 5_000,
        TimeSpan? delayBetweenBatches = null,
        CancellationToken ct = default)
    {
        // AuditLog.At has no HasColumnType -> default Npgsql mapping is timestamptz, which requires Kind = Utc.
        var cutoff = DateTime.UtcNow - (olderThan ?? TimeSpan.FromDays(365));
        var delay = delayBetweenBatches ?? TimeSpan.Zero;

        long totalDeleted = 0;
        int deletedInBatch;
        do
        {
            // Batched, each ExecuteDelete its own short implicit transaction: a single 40M-row DELETE would hold locks and block autovacuum for the whole run.
            deletedInBatch = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Take(batchSize)
                .ExecuteDeleteAsync(ct);

            totalDeleted += deletedInBatch;

            if (deletedInBatch > 0 && delay > TimeSpan.Zero)
                await Task.Delay(delay, ct);
        } while (deletedInBatch > 0);

        return totalDeleted;
    }

    // Tracked SaveChanges, not ExecuteUpdate: the increment depends on each product's current Stock, not a single shared expression.
    public async Task RestockAsync(IEnumerable<(Guid id, int add)> deltas, CancellationToken ct = default)
    {
        var addById = deltas
            .GroupBy(d => d.id)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.add));

        if (addById.Count == 0)
            return;

        var ids = addById.Keys.ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var product in products)
            product.Stock += addById[product.Id];

        await _db.SaveChangesAsync(ct);
    }

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
