namespace Shop.Data;

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    // Deducts stock without races under concurrent reservations for the same product.
    // Plain "read Stock, subtract, SaveChanges" races: two concurrent reservations can
    // both read Stock=5, both decide qty=3 fits, and both commit, leaving Stock=-1.
    // SELECT ... FOR UPDATE row-locks the product row so a second concurrent Reserve
    // for the same productId blocks until the first transaction commits (and then sees
    // the already-decremented Stock). FOR UPDATE only holds the lock for the lifetime of
    // the transaction, so it must run inside one (BeginTransactionAsync ... CommitAsync) -
    // without it the lock is released right after the SELECT and offers no protection.
    public async Task ReserveAsync(Guid productId, int qty)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty), "qty must be positive");

        await using var tx = await _db.Database.BeginTransactionAsync();

        var product = await _db.Products
            .FromSqlRaw("SELECT * FROM \"Products\" p WHERE p.\"Id\" = {0} FOR UPDATE", productId)
            .SingleOrDefaultAsync();

        if (product is null)
            throw new InvalidOperationException($"Product {productId} not found");

        if (product.Stock < qty)
            throw new InvalidOperationException(
                $"Not enough stock for product {productId}: requested {qty}, available {product.Stock}");

        product.Stock -= qty;

        await _db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    // Dynamic search filter (category / min price) built as parameterized FromSqlRaw.
    // The alias used in every condition ("p.") matches the alias declared in the
    // template's FROM clause; keeping them in lockstep here (both built in this one
    // method) avoids the classic "missing FROM-clause entry" runtime failure that
    // shows up when the template and the conditions are assembled in different places.
    // Values are never concatenated into the SQL text - each condition contributes its
    // own {n} placeholder and the actual value travels in the parameters array, so
    // FromSqlRaw turns it into a real provider parameter (no SQL injection).
    public IQueryable<Product> SearchProducts(string? category, decimal? minPrice)
    {
        const string alias = "p";
        var conditions = new List<string>();
        var parameters = new List<object>();

        if (!string.IsNullOrEmpty(category))
        {
            conditions.Add($"{alias}.\"Category\" = {{{parameters.Count}}}");
            parameters.Add(category);
        }

        if (minPrice.HasValue)
        {
            conditions.Add($"{alias}.\"Price\" >= {{{parameters.Count}}}");
            parameters.Add(minPrice.Value);
        }

        var where = conditions.Count > 0 ? string.Join(" AND ", conditions) : "1 = 1";
        var sql = string.Format("SELECT * FROM \"Products\" {1} WHERE {0}", where, alias);

        return _db.Products.FromSqlRaw(sql, parameters.ToArray());
    }
}
