using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate - без загрузки строк категории в Change Tracker.
    public Task<int> RaisePricesAsync(string category, decimal percent = 0.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percent)), ct);

    // Take нельзя внутри ExecuteDelete (efcore#1919, efcore.pg#3231) - id батча берём отдельным SELECT.
    public async Task<long> PurgeOldAuditLogsAsync(
        TimeSpan? retention = null,
        int batchSize = 10_000,
        CancellationToken ct = default)
    {
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow - (retention ?? TimeSpan.FromDays(365)), DateTimeKind.Unspecified);
        long totalDeleted = 0;

        while (true)
        {
            ct.ThrowIfCancellationRequested();

            var batchIds = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Take(batchSize)
                .Select(a => a.Id)
                .ToListAsync(ct);

            if (batchIds.Count == 0)
                break;

            totalDeleted += await _db.AuditLogs
                .Where(a => batchIds.Contains(a.Id))
                .ExecuteDeleteAsync(ct);
        }

        return totalDeleted;
    }

    public async Task<int> RestockAsync(IEnumerable<(Guid Id, int Add)> deltas, CancellationToken ct = default)
    {
        var deltaList = deltas as IReadOnlyCollection<(Guid Id, int Add)> ?? deltas.ToList();
        if (deltaList.Count == 0)
            return 0;

        var ids = deltaList.Select(d => d.Id).ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var (id, add) in deltaList)
        {
            if (products.TryGetValue(id, out var product))
                product.Stock += add;
        }

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
            Stock = stock,
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return product;
    }
}
