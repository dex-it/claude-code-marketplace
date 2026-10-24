using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    /// <summary>
    /// Списывает qty со склада без гонок при параллельных резервах.
    /// SELECT ... FOR UPDATE блокирует строку товара до конца транзакции,
    /// поэтому второй параллельный вызов Reserve для того же productId
    /// дождётся коммита/отката первого и увидит уже актуальный Stock -
    /// потерянных обновлений (lost update) не будет. Транзакцию открываем
    /// явно: иначе SELECT и последующий UPDATE (через SaveChangesAsync)
    /// выполнились бы каждый в своей автономной транзакции, и блокировка
    /// снялась бы сразу после SELECT, до записи нового остатка.
    /// Возвращает false, если товара нет или остатка недостаточно.
    /// </summary>
    public async Task<bool> ReserveAsync(Guid productId, int qty)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty), "qty должно быть положительным.");

        await using var tx = await _db.Database.BeginTransactionAsync();

        // Условие сразу внутри raw SQL, а не через .Where(...)/.SingleOrDefaultAsync()
        // поверх FromSqlRaw: EF Core может дописать составленный LINQ-запрос как
        // подзапрос (например, добавить LIMIT для проверки единственности), а
        // "SELECT ... FOR UPDATE" не в любой такой композиции транслируется/ведёт
        // себя предсказуемо в Postgres. Поэтому берём ровно одну строку без
        // дальнейшей LINQ-композиции поверх результата FromSqlRaw.
        var products = await _db.Products
            .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId)
            .AsTracking()
            .ToListAsync();
        var product = products.SingleOrDefault();

        if (product is null || product.Stock < qty)
        {
            await tx.RollbackAsync();
            return false;
        }

        product.Stock -= qty;
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return true;
    }

    private const string SearchSqlTemplate = "SELECT * FROM \"Products\" p WHERE {0}";

    /// <summary>
    /// Поиск товаров с динамическим набором условий (категория, мин. цена).
    /// В SQL-текст подставляются только имена колонок/операторы (фиксированные
    /// строки), а сами значения параметров всегда идут через параметры
    /// FromSqlRaw ({0}, {1}, ...) - никогда не интерполируются как литералы,
    /// поэтому SQL-инъекция через category/minPrice исключена.
    /// Выборка только для чтения -> AsNoTracking.
    /// </summary>
    public async Task<List<Product>> SearchAsync(string? category, decimal? minPrice)
    {
        var conditions = new List<string>();
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

        var whereClause = conditions.Count > 0 ? string.Join(" AND ", conditions) : "1 = 1";
        var sql = string.Format(SearchSqlTemplate, whereClause);

        return await _db.Products
            .FromSqlRaw(sql, args.ToArray())
            .AsNoTracking()
            .ToListAsync();
    }
}
