using System.Data;

namespace Shop.Data;

public enum ReserveResult { Success, InsufficientStock, NotFound }

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    // Decrements Stock for productId by qty without races between concurrent reservations.
    //
    // SELECT ... FOR UPDATE takes a row-level lock on the product's row for the life of the
    // transaction. A second, concurrent ReserveAsync for the *same* product blocks on this
    // statement until the first transaction commits or rolls back, and then reads the row as
    // it stands after that commit - so two reservations can never both read the same "old"
    // Stock and each independently subtract from it (no lost update). Reservations for
    // different products don't block each other, since each only locks its own row.
    //
    // The FromSqlRaw query is materialized with a plain ToListAsync and nothing else is
    // composed onto it, so EF executes the SQL exactly as written (including FOR UPDATE)
    // instead of wrapping it in a subquery.
    public async Task<ReserveResult> ReserveAsync(Guid productId, int qty)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty), "qty must be positive.");

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        try
        {
            var rows = await _db.Products
                .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId)
                .ToListAsync();
            var product = rows.SingleOrDefault();

            if (product is null)
            {
                await transaction.RollbackAsync();
                return ReserveResult.NotFound;
            }

            if (product.Stock < qty)
            {
                await transaction.RollbackAsync();
                return ReserveResult.InsufficientStock;
            }

            product.Stock -= qty;
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return ReserveResult.Success;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Dynamic product search over an optional category / minimum price.
    //
    // The WHERE clause is assembled only from a hardcoded whitelist of column/operator
    // fragments ("p.\"Category\" = {n}", "p.\"Price\" >= {n}"); the actual filter *values*
    // never get concatenated into the SQL text - they're collected into `parameters` and
    // reach the database solely as FromSqlRaw's positional parameters, so the query stays
    // parameterized/injection-safe regardless of what the caller passes as category.
    public Task<List<Product>> SearchAsync(string? category, decimal? minPrice)
    {
        var conditions = new List<string> { "1=1" };
        var parameters = new List<object>();

        if (!string.IsNullOrWhiteSpace(category))
        {
            conditions.Add($"p.\"Category\" = {{{parameters.Count}}}");
            parameters.Add(category);
        }

        if (minPrice.HasValue)
        {
            conditions.Add($"p.\"Price\" >= {{{parameters.Count}}}");
            parameters.Add(minPrice.Value);
        }

        var sql = string.Format("SELECT * FROM \"Products\" p WHERE {0}", string.Join(" AND ", conditions));

        // Read-only search results: no change tracking needed.
        return _db.Products
            .FromSqlRaw(sql, parameters.ToArray())
            .AsNoTracking()
            .ToListAsync();
    }
}
