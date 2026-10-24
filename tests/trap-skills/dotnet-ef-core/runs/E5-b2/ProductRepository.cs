using System.Data;

namespace Shop.Data;

// Бросается, если на складе не хватает остатка под запрошенное количество.
public class InsufficientStockException : Exception
{
    public InsufficientStockException(Guid productId, int requested, int available)
        : base($"Product {productId}: requested {requested}, available {available}.") { }
}

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    // (b) Списание остатка со склада без гонок при параллельных резервах.
    //
    // Обычный "прочитать Stock -> проверить -> вычесть -> SaveChanges" гонится:
    // два параллельных резерва одного и того же товара оба читают старое
    // значение Stock, оба проходят проверку "хватает" и оба сохраняют,
    // в итоге склад уходит в минус (lost update).
    //
    // Решение: в явной транзакции блокируем строку товара пессимистично через
    // "SELECT ... FOR UPDATE" (FromSqlRaw) - вторая параллельная транзакция,
    // резервирующая тот же productId, встанет на этом SELECT и подождёт, пока
    // первая не закоммитится/откатится, и увидит уже актуальный Stock.
    public async Task ReserveAsync(Guid productId, int qty, CancellationToken ct = default)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty), "Qty must be positive.");

        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

            var locked = await _db.Products
                .FromSqlRaw(
                    "SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE",
                    productId)
                .AsTracking()
                .SingleOrDefaultAsync(ct);

            if (locked is null)
                throw new InvalidOperationException($"Product {productId} not found.");

            if (locked.Stock < qty)
                throw new InsufficientStockException(productId, qty, locked.Stock);

            locked.Stock -= qty;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });
    }

    // (c) Поиск продуктов с динамическим фильтром (категория, минимальная цена).
    //
    // Условия WHERE собираются динамически (набор условий зависит от того, какие
    // параметры переданы), но значения никогда не подставляются в текст SQL
    // напрямую - только через плейсхолдеры {0}, {1}, ..., которые FromSqlRaw
    // превращает в настоящие параметры Npgsql (NpgsqlParameter), а не в
    // текстовую подстановку. Это исключает SQL-инъекцию через category/minPrice.
    public async Task<List<Product>> SearchAsync(string? category, decimal? minPrice, CancellationToken ct = default)
    {
        const string template = "SELECT * FROM \"Products\" p WHERE {0}";

        var conditions = new List<string> { "1=1" }; // безопасная заглушка, если фильтров нет
        var args = new List<object>();

        if (!string.IsNullOrWhiteSpace(category))
        {
            conditions.Add($"p.\"Category\" = {{{args.Count}}}");
            args.Add(category);
        }

        if (minPrice.HasValue)
        {
            conditions.Add($"p.\"Price\" >= {{{args.Count}}}");
            args.Add(minPrice.Value);
        }

        var where = string.Join(" AND ", conditions);
        var sql = string.Format(template, where);

        return await _db.Products.FromSqlRaw(sql, args.ToArray()).ToListAsync(ct);
    }
}
