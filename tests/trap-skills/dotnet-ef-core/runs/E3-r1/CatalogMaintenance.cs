using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public readonly record struct RestockResult(int Updated, IReadOnlyList<Guid> NotFound);

public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdateAsync - один UPDATE без загрузки строк и без Change Tracker (learn.microsoft.com/ef/core/saving/execute-insert-update-delete)
    public Task<int> RaisePricesAsync(string category, decimal percent = 0.10m, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * (1 + percent)), ct);

    public async Task<long> PurgeOldAuditLogsAsync(
        TimeSpan retention,
        int batchSize = 5000,
        TimeSpan delayBetweenBatches = default,
        CancellationToken ct = default)
    {
        // At = "timestamp without time zone" -> Npgsql 6+ требует Kind Unspecified/Local (npgsql.org/doc/types/datetime.html)
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow - retention, DateTimeKind.Unspecified);
        long totalDeleted = 0;

        while (true)
        {
            // Postgres не поддерживает DELETE...LIMIT, а Skip/Take в ExecuteDelete не транслируется (dotnet/efcore#30185)
            var boundaryId = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Skip(batchSize - 1)
                .Select(a => (long?)a.Id)
                .FirstOrDefaultAsync(ct);

            if (boundaryId is null)
            {
                totalDeleted += await _db.AuditLogs.Where(a => a.At < cutoff).ExecuteDeleteAsync(ct);
                break;
            }

            totalDeleted += await _db.AuditLogs
                .Where(a => a.At < cutoff && a.Id <= boundaryId.Value)
                .ExecuteDeleteAsync(ct);

            if (delayBetweenBatches > TimeSpan.Zero)
                await Task.Delay(delayBetweenBatches, ct);
        }

        return totalDeleted;
    }

    public async Task<RestockResult> RestockAsync(IEnumerable<(Guid Id, int Add)> items, CancellationToken ct = default)
    {
        var list = items.ToList();
        var ids = list.Select(i => i.Id).ToList();

        // Contains по List<Guid> -> WHERE Id = ANY(@ids), один round-trip (npgsql.org/efcore/mapping/array.html)
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var notFound = new List<Guid>();
        foreach (var (id, add) in list)
        {
            if (products.TryGetValue(id, out var product))
                product.Stock += add;
            else
                notFound.Add(id);
        }

        await _db.SaveChangesAsync(ct);
        return new RestockResult(list.Count - notFound.Count, notFound);
    }

    public async Task<Product> CreateProductAsync(
        string sku,
        string category,
        string warehouse,
        decimal price,
        int initialStock = 0,
        CancellationToken ct = default)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Category = category,
            Warehouse = warehouse,
            Price = price,
            Stock = initialStock,
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return product;
    }
}
