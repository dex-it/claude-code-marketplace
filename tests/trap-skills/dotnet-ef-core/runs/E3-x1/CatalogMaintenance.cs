// Shop.Data - CatalogMaintenance: bulk price changes, nightly AuditLog purge, restock, product creation.
namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    // AuditLogs: ~50M rows total, ~40M eligible for deletion. A single unbounded
    // DELETE/ExecuteDeleteAsync would run as one long transaction, hold locks on the
    // table for the whole run and bloat the WAL, so the purge is chunked instead.
    private const int AuditLogPurgeBatchSize = 5_000;
    private static readonly TimeSpan AuditLogPurgeBatchDelay = TimeSpan.FromMilliseconds(50);

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    /// <summary>
    /// (a) Raises the price of every product in the given category by 10%.
    /// Uses ExecuteUpdateAsync so the change runs as a single translated SQL UPDATE
    /// instead of loading every product row into memory and tracking it.
    /// </summary>
    public Task<int> RaisePricesAsync(string category, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.10m), ct);

    /// <summary>
    /// (b) Nightly cleanup: deletes AuditLogs older than one year.
    /// AuditLog.At has no HasColumnType override in OnModelCreating, so with Npgsql 8 it
    /// maps to `timestamptz` - the cutoff is built from DateTime.UtcNow (Kind=Utc) to match.
    /// Deletion is batched (raw SQL DELETE ... WHERE Id IN (subquery ... LIMIT n)) with a
    /// short pause between batches, because ~40M of ~50M rows are expected to qualify and
    /// deleting them in one shot would be a single multi-hour transaction locking the table.
    /// Run this from a scheduled job outside of request-serving code.
    /// </summary>
    public async Task<long> PurgeOldAuditLogsAsync(CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddYears(-1);
        long totalDeleted = 0;

        while (true)
        {
            ct.ThrowIfCancellationRequested();

            var deleted = await _db.Database.ExecuteSqlInterpolatedAsync($@"
DELETE FROM ""AuditLogs""
WHERE ""Id"" IN (
    SELECT ""Id"" FROM ""AuditLogs""
    WHERE ""At"" < {cutoff}
    ORDER BY ""Id""
    LIMIT {AuditLogPurgeBatchSize}
);", ct);

            totalDeleted += deleted;

            if (deleted < AuditLogPurgeBatchSize)
                break;

            await Task.Delay(AuditLogPurgeBatchDelay, ct);
        }

        return totalDeleted;
    }

    /// <summary>
    /// (c) Loads the given products and increases their Stock, then saves.
    /// Duplicate ids in the input are summed first, so the same product isn't loaded twice
    /// and repeated increments for the same id aren't lost.
    /// </summary>
    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> deltas, CancellationToken ct = default)
    {
        var addById = new Dictionary<Guid, int>();
        foreach (var (id, add) in deltas)
            addById[id] = addById.TryGetValue(id, out var existing) ? existing + add : add;

        if (addById.Count == 0)
            return;

        var ids = addById.Keys.ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct); // tracked on purpose: Stock is mutated below and persisted via SaveChangesAsync

        foreach (var product in products)
            product.Stock += addById[product.Id];

        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// (d) Creates a new product with a freshly generated id.
    /// </summary>
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
            Stock = stock,
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);

        return product;
    }
}
