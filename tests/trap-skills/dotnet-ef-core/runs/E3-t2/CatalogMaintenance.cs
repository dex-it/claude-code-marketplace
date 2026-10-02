using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

// Ночной прогон CleanupAuditLogsAsync планирует внешний планировщик (cron/Hangfire) - сам метод таймера не держит.
public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate - SQL UPDATE напрямую, без загрузки строк категории в Change Tracker.
    public Task<int> RaisePricesAsync(string category, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m), ct);

    // Батч + commit каждого шага (не один DELETE на ~40 млн строк) даёт autovacuum забирать место по ходу.
    public async Task<long> CleanupAuditLogsAsync(
        int retentionYears = 1,
        int batchSize = 10_000,
        TimeSpan? delayBetweenBatches = null,
        CancellationToken ct = default)
    {
        if (batchSize <= 0) throw new ArgumentOutOfRangeException(nameof(batchSize));

        // AuditLog.At без HasColumnType мапится Npgsql в timestamptz, который принимает только DateTimeKind.Utc.
        var cutoff = DateTime.UtcNow.AddYears(-retentionYears);
        var pause = delayBetweenBatches ?? TimeSpan.FromMilliseconds(200);

        _db.Database.SetCommandTimeout(TimeSpan.FromMinutes(2));

        long totalDeleted = 0;
        while (true)
        {
            ct.ThrowIfCancellationRequested();

            // ExecuteDelete отказывает на запросе с OrderBy/Skip/Take - границу батча читают отдельным запросом.
            var boundaryId = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Skip(batchSize - 1)
                .Select(a => (long?)a.Id)
                .FirstOrDefaultAsync(ct);

            var deleted = boundaryId.HasValue
                ? await _db.AuditLogs.Where(a => a.At < cutoff && a.Id <= boundaryId.Value).ExecuteDeleteAsync(ct)
                : await _db.AuditLogs.Where(a => a.At < cutoff).ExecuteDeleteAsync(ct);

            totalDeleted += deleted;
            if (deleted == 0)
                break;

            if (pause > TimeSpan.Zero)
                await Task.Delay(pause, ct);
        }

        return totalDeleted;
    }

    // Тут нужен Change Tracker: у каждого продукта своя дельта, один SQL UPDATE такой набор не выразит.
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
