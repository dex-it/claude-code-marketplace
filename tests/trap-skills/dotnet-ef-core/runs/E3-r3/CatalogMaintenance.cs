namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;
    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate bypasses the change tracker - no need to materialize matching products
    public Task<int> RaisePricesByCategoryAsync(string category, decimal percentage = 0.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percentage)), ct);

    // At maps to timestamptz (no HasColumnType => Npgsql EF provider default); cutoff must carry Kind=Utc or Npgsql throws
    public async Task<long> PurgeOldAuditLogsAsync(
        TimeSpan? olderThan = null,
        int batchSize = 5_000,
        TimeSpan? delayBetweenBatches = null,
        CancellationToken ct = default)
    {
        var cutoffUtc = DateTime.UtcNow - (olderThan ?? TimeSpan.FromDays(365));
        var pause = delayBetweenBatches ?? TimeSpan.FromMilliseconds(200);
        long totalDeleted = 0;

        while (true)
        {
            ct.ThrowIfCancellationRequested();

            // ExecuteDelete has no Take/OrderBy support, so the batch's ids are selected first and deleted by id
            var idsBatch = await _db.AuditLogs
                .Where(a => a.At < cutoffUtc)
                .Select(a => a.Id)
                .Take(batchSize)
                .ToListAsync(ct);

            if (idsBatch.Count == 0)
                break;

            totalDeleted += await _db.AuditLogs
                .Where(a => idsBatch.Contains(a.Id))
                .ExecuteDeleteAsync(ct);

            if (idsBatch.Count < batchSize)
                break;

            if (pause > TimeSpan.Zero)
                await Task.Delay(pause, ct);
        }

        return totalDeleted;
    }

    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> restocks, CancellationToken ct = default)
    {
        // sum duplicate ids up front so each product is loaded and updated once
        var totals = restocks
            .GroupBy(r => r.Id)
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Add));

        if (totals.Count == 0)
            return;

        var ids = totals.Keys.ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var product in products)
            product.Stock += totals[product.Id];

        await _db.SaveChangesAsync(ct);
    }

    public async Task<Product> CreateProductAsync(string sku, string warehouse, string category, decimal price, int stock, CancellationToken ct = default)
    {
        // explicit non-default Guid wins over EF's client-side generator (docs: "Overriding value generation")
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
