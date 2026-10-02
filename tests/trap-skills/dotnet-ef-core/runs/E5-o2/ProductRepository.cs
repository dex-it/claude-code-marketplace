using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class InsufficientStockException : Exception
{
    public Guid ProductId { get; }
    public InsufficientStockException(Guid productId, int requested, int available)
        : base($"Product {productId}: requested {requested}, available {available}.")
        => ProductId = productId;
}

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    /// <summary>
    /// Списывает <paramref name="qty"/> со склада продукта без гонок при параллельных
    /// резервах. SELECT ... FOR UPDATE блокирует строку продукта до конца транзакции,
    /// поэтому второй параллельный вызов Reserve для того же product дожидается
    /// коммита первого и видит уже уменьшенный остаток - остаток не может уйти
    /// в минус даже при одновременных резервах с разных запросов/потоков.
    /// FOR UPDATE обязательно оборачивать в явную транзакцию: вне транзакции
    /// блокировка снимается сразу после SELECT и защиты не даёт.
    /// </summary>
    public async Task ReserveAsync(Guid productId, int qty)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty), "Qty must be positive.");

        await using var tx = await _db.Database.BeginTransactionAsync();

        var product = await _db.Products
            .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId)
            .SingleOrDefaultAsync();

        if (product is null)
            throw new InvalidOperationException($"Product {productId} not found.");

        if (product.Stock < qty)
            throw new InsufficientStockException(productId, qty, product.Stock);

        product.Stock -= qty;

        await _db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    /// <summary>
    /// Поиск продуктов по динамическому набору условий (категория, минимальная цена).
    /// Шаблон SQL фиксирован, условия добавляются в WHERE только как параметризованные
    /// плейсхолдеры FromSqlRaw ({0}, {1}, ...) - значения category/minPrice никогда не
    /// подставляются в текст SQL напрямую, только как SQL-параметры, что закрывает SQL
    /// injection. Алиас таблицы в шаблоне ("p") и в условиях - один и тот же Alias
    /// константа, иначе Postgres упадёт в рантайме на "missing FROM-clause entry for table".
    /// Read-only запрос -> AsNoTracking, чтобы не раздувать Change Tracker.
    /// </summary>
    public async Task<List<Product>> SearchAsync(string? category, decimal? minPrice)
    {
        const string Alias = "p";
        const string sqlTemplate = "SELECT * FROM \"Products\" " + Alias + " WHERE {0}";

        var conditions = new List<string>();
        var parameters = new List<object>();

        if (!string.IsNullOrWhiteSpace(category))
        {
            conditions.Add($"{Alias}.\"Category\" = {{{parameters.Count}}}");
            parameters.Add(category);
        }

        if (minPrice.HasValue)
        {
            conditions.Add($"{Alias}.\"Price\" >= {{{parameters.Count}}}");
            parameters.Add(minPrice.Value);
        }

        var whereClause = conditions.Count > 0 ? string.Join(" AND ", conditions) : "1 = 1";
        var sql = string.Format(sqlTemplate, whereClause);

        return await _db.Products
            .FromSqlRaw(sql, parameters.ToArray())
            .AsNoTracking()
            .ToListAsync();
    }
}
