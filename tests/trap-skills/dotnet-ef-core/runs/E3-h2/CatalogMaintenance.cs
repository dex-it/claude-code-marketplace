namespace Shop.Data;

// Батч-удаление ниже требует индекс на AuditLogs(At) - завести отдельной миграцией (IsCreatedConcurrently), не здесь.
public class CatalogMaintenance
{
    private const int AuditLogCleanupBatchSize = 5_000;
    private static readonly TimeSpan AuditLogCleanupBatchDelay = TimeSpan.FromMilliseconds(200);

    private readonly ShopDbContext _db;
    public CatalogMaintenance(ShopDbContext db) => _db = db;

    // ExecuteUpdate - без загрузки строк категории и без change tracker.
    public Task<int> IncreasePricesByCategoryAsync(string category, CancellationToken ct = default) =>
        _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m), ct);

    public async Task CleanupOldAuditLogsAsync(CancellationToken ct = default)
    {
        // AuditLog.At без HasColumnType => timestamptz (дефолт Npgsql 6+); нужен именно UtcNow (Kind=Utc), иначе Npgsql бросит на записи параметра.
        var cutoff = DateTime.UtcNow.AddYears(-1);

        int deleted;
        do
        {
            // ExecuteDelete не документирует Skip/Take и не батчует вызовы - порции идут raw SQL с LIMIT по подзапросу.
            deleted = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                DELETE FROM ""AuditLogs""
                WHERE ""Id"" IN (
                    SELECT ""Id"" FROM ""AuditLogs""
                    WHERE ""At"" < {cutoff}
                    ORDER BY ""Id""
                    LIMIT {AuditLogCleanupBatchSize}
                )", ct);

            // Пауза между порциями оставляет окна для автовакуума на 50-миллионной таблице.
            if (deleted > 0)
                await Task.Delay(AuditLogCleanupBatchDelay, ct);
        } while (deleted > 0);
    }

    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> items, CancellationToken ct = default)
    {
        // GroupBy - защита от повтора id во входной коллекции (иначе делта одного из повторов теряется молча).
        var deltas = items
            .GroupBy(i => i.Id)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Add));
        if (deltas.Count == 0) return;

        var ids = deltas.Keys.ToList();
        // ids.Contains транслируется Npgsql в "= ANY(@array)" - один параметр-массив, чанкинг по размеру items не нужен.
        var products = await _db.Products.Where(p => ids.Contains(p.Id)).ToListAsync(ct);
        foreach (var product in products)
            product.Stock += deltas[product.Id];

        await _db.SaveChangesAsync(ct);
    }

    public async Task<Product> CreateProductAsync(
        string sku, string warehouse, string category, decimal price, int stock, CancellationToken ct = default)
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
