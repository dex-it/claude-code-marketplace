using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    public Task<int> IncreasePricesByCategoryAsync(string category, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m), ct);

    // ExecuteDelete не поддерживает Take, а один DELETE на ~40 млн строк держит долгую блокировку и раздувает WAL/bloat - удаляем пачками PK.
    public async Task<long> PurgeOldAuditLogsAsync(
        int batchSize = 5_000,
        TimeSpan? delayBetweenBatches = null,
        CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddYears(-1);
        var delay = delayBetweenBatches ?? TimeSpan.FromMilliseconds(200);
        long totalDeleted = 0;

        while (true)
        {
            var ids = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Select(a => a.Id)
                .Take(batchSize)
                .ToListAsync(ct);

            if (ids.Count == 0)
                break;

            totalDeleted += await _db.AuditLogs
                .Where(a => ids.Contains(a.Id))
                .ExecuteDeleteAsync(ct);

            if (ids.Count < batchSize)
                break;

            await Task.Delay(delay, ct);
        }

        return totalDeleted;
    }

    public async Task Restock(IEnumerable<(Guid id, int add)> updates, CancellationToken ct = default)
    {
        var addById = new Dictionary<Guid, int>();
        foreach (var (id, add) in updates)
            addById[id] = addById.TryGetValue(id, out var existing) ? existing + add : add;

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

    public async Task<Product> CreateProduct(
        string sku,
        string category,
        string warehouse,
        decimal price,
        int stock,
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
