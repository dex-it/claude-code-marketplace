namespace Shop.Data;

/// <summary>
/// Обслуживание каталога: массовая переоценка, ночная чистка аудита, дозагрузка стока и создание товаров.
/// </summary>
public class CatalogMaintenance
{
    private readonly ShopDbContext _db;

    public CatalogMaintenance(ShopDbContext db) => _db = db;

    /// <summary>
    /// (а) Поднимает цену всем продуктам категории на заданный процент (10% по умолчанию).
    /// ExecuteUpdateAsync - без загрузки строк в память и без трекинга, выражение p.Price * multiplier
    /// транслируется в SQL целиком (не C#-метод, значит переводимо).
    /// </summary>
    public Task<int> RaisePricesByCategoryAsync(string category, decimal percent = 0.10m, CancellationToken ct = default)
    {
        var multiplier = 1m + percent;
        return _db.Products
            .Where(p => p.Category == category)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * multiplier), ct);
    }

    /// <summary>
    /// (б) Ночная очистка AuditLogs старше года. Таблица ~50 млн строк, под удаление ~40 млн -
    /// один ExecuteDeleteAsync на весь диапазон запёр бы таблицу и раздул WAL на время одной огромной
    /// транзакции. Поэтому удаляем пачками: на каждой итерации выбираем только id (long, не всю строку)
    /// небольшого фиксированного среза, затем удаляем этот срез отдельной короткой транзакцией.
    /// AuditLog.At не имеет явного HasColumnType => маппится как timestamptz (Npgsql 8, .NET 8),
    /// поэтому сравнение ведём с DateTime.UtcNow (Kind=Utc), а не DateTime.Now.
    /// </summary>
    public async Task<long> PurgeOldAuditLogsAsync(TimeSpan? olderThan = null, int batchSize = 5_000, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - (olderThan ?? TimeSpan.FromDays(365));
        long totalDeleted = 0;

        while (true)
        {
            ct.ThrowIfCancellationRequested();

            var idsBatch = await _db.AuditLogs
                .AsNoTracking()
                .Where(a => a.At < cutoff)
                .OrderBy(a => a.Id)
                .Select(a => a.Id)
                .Take(batchSize)
                .ToListAsync(ct);

            if (idsBatch.Count == 0)
                break;

            var deleted = await _db.AuditLogs
                .Where(a => idsBatch.Contains(a.Id))
                .ExecuteDeleteAsync(ct);

            totalDeleted += deleted;

            if (idsBatch.Count < batchSize)
                break;
        }

        return totalDeleted;
    }

    /// <summary>
    /// (в) Догружает сток по списку (id, add). Дубли id во входной коллекции схлопываются суммированием
    /// перед загрузкой сущностей, иначе применение по одному тюплу за раз на одном и том же отслеживаемом
    /// продукте зависело бы от порядка перечисления и легко было бы прочитать как баг. Загрузка - с
    /// трекингом (без AsNoTracking), т.к. записи будут изменены и сохранены в этом же контексте.
    /// </summary>
    public async Task RestockAsync(IEnumerable<(Guid Id, int Add)> deltas, CancellationToken ct = default)
    {
        var aggregated = deltas
            .GroupBy(d => d.Id)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Add));

        if (aggregated.Count == 0)
            return;

        var ids = aggregated.Keys.ToList();
        var products = await _db.Products
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var product in products)
            product.Stock += aggregated[product.Id];

        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// (г) Создаёт продукт с новым Guid.
    /// </summary>
    public async Task<Product> CreateProductAsync(
        string sku,
        string category,
        decimal price,
        int stock = 0,
        string warehouse = "",
        CancellationToken ct = default)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Category = category,
            Price = price,
            Stock = stock,
            Warehouse = warehouse,
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);

        return product;
    }
}
