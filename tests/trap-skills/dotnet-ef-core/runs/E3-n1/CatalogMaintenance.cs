using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class CatalogMaintenance
{
    // ExecuteDelete не поддерживает OrderBy/Skip/Take - границу батча берёт отдельный SELECT.
    private const int AuditLogCleanupBatchSize = 5000;

    private readonly ShopDbContext _db;
    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate - один set-based UPDATE на категорию, без загрузки строк и трекинга.
    public Task<int> RaisePricesByCategoryAsync(string category, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m), ct);

    // Батч по Id, не Skip/OFFSET: смещение не деградирует, каждый батч - своя короткая транзакция.
    public async Task<long> CleanupOldAuditLogsAsync(CancellationToken ct = default)
    {
        // At без HasColumnType -> дефолт Npgsql "timestamp without time zone", Kind=Utc он отклоняет.
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow.AddYears(-1), DateTimeKind.Unspecified);

        var totalDeleted = 0L;
        while (true)
        {
            var batchIds = await _db.AuditLogs
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Select(a => a.Id)
                .Take(AuditLogCleanupBatchSize)
                .ToListAsync(ct);

            if (batchIds.Count == 0)
                break;

            totalDeleted += await _db.AuditLogs
                .Where(a => batchIds.Contains(a.Id))
                .ExecuteDeleteAsync(ct);
        }

        return totalDeleted;
    }

    // ToDictionaryAsync не трекает результат (efcore#25158) - грузим ToListAsync, словарь строим в памяти.
    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> updates, CancellationToken ct = default)
    {
        var deltas = updates.ToList();
        if (deltas.Count == 0)
            return;

        var ids = deltas.Select(d => d.Id).ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);
        var byId = products.ToDictionary(p => p.Id);

        foreach (var (id, add) in deltas)
        {
            if (byId.TryGetValue(id, out var product))
                product.Stock += add;
        }

        await _db.SaveChangesAsync(ct);
    }

    // Guid ставим до Add - EF использует переданное значение вместо своей генерации ключа.
    public async Task<Product> CreateProductAsync(
        string sku, string category, string warehouse, decimal price, int stock, CancellationToken ct = default)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Category = category,
            Warehouse = warehouse,
            Price = price,
            Stock = stock
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        return product;
    }
}
