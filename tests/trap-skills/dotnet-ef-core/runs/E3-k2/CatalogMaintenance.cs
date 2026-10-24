namespace Shop.Data;

public class CatalogMaintenance
{
    // Small batches with a pause: a single 40M-row delete would hold locks/WAL for its whole duration.
    private const int AuditLogDeleteBatchSize = 5_000;
    private static readonly TimeSpan AuditLogBatchPause = TimeSpan.FromMilliseconds(200);

    private readonly ShopDbContext _db;
    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdateAsync: SQL UPDATE against all matching rows, no materialization, no Change Tracker.
    public Task<int> RaisePricesAsync(string category, decimal percent = 0.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percent)), ct);

    // Raw SQL with a LIMIT subquery, not ExecuteDeleteAsync().Take(): ExecuteDelete on Npgsql fails to translate past simple predicates (npgsql/efcore.pg#3231), Take/Skip included.
    public async Task<long> CleanupAuditLogsAsync(CancellationToken ct = default)
    {
        // "At" has no HasColumnType override, so Npgsql 6+ maps it to timestamptz, which requires Kind=Utc on write.
        var cutoff = DateTime.UtcNow.AddYears(-1);
        var totalDeleted = 0L;

        int deleted;
        do
        {
            deleted = await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""
                 DELETE FROM "AuditLogs"
                 WHERE "Id" IN (
                     SELECT "Id" FROM "AuditLogs"
                     WHERE "At" < {cutoff}
                     ORDER BY "Id"
                     LIMIT {AuditLogDeleteBatchSize}
                 )
                 """, ct);
            totalDeleted += deleted;

            if (deleted == AuditLogDeleteBatchSize)
                await Task.Delay(AuditLogBatchPause, ct);
        }
        while (deleted == AuditLogDeleteBatchSize);

        return totalDeleted;
    }

    // Products stay tracked here (unlike a read-only lookup): we write Stock and need SaveChanges to see it.
    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> deltas, CancellationToken ct = default)
    {
        var addById = deltas
            .GroupBy(d => d.Id)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.Add));
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
