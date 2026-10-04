using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class ProductRepository
{
    private readonly ShopDbContext _db;
    public ProductRepository(ShopDbContext db) => _db = db;

    /// <summary>
    /// Reserves <paramref name="qty"/> units of a product's stock, safely under
    /// concurrent reservations (e.g. two operators/customers reserving from the
    /// same product at the same time).
    ///
    /// A naive "read Stock, check Stock &gt;= qty, write Stock - qty" is a classic
    /// race: two concurrent calls can both read the same Stock, both pass the
    /// check, and both write, oversubscribing the warehouse. To prevent that we
    /// take a row-level lock on the product row with "SELECT ... FOR UPDATE" (via
    /// FromSqlRaw, since EF Core's LINQ provider has no FOR UPDATE support) inside
    /// an explicit transaction. Postgres blocks any other transaction trying to
    /// SELECT ... FOR UPDATE (or UPDATE) that same row until this one commits or
    /// rolls back, so the read-check-decrement below is effectively atomic across
    /// concurrent reservations.
    /// </summary>
    public async Task ReserveAsync(Guid productId, int qty, CancellationToken ct = default)
    {
        if (qty <= 0)
            throw new ArgumentOutOfRangeException(nameof(qty), "Quantity must be positive.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var product = await _db.Products
            .FromSqlRaw(
                "SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE",
                productId)
            .SingleOrDefaultAsync(ct);

        if (product is null)
            throw new InvalidOperationException($"Product {productId} not found.");

        if (product.Stock < qty)
            throw new InsufficientStockException(productId, requested: qty, available: product.Stock);

        product.Stock -= qty;
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Searches products, filtering by category and/or a minimum price when those
    /// are supplied, with the WHERE clause assembled dynamically depending on which
    /// filters are present.
    ///
    /// Only fixed, non-user-controlled fragments (column names, operators, "AND")
    /// are ever built up as raw SQL text. The actual category/minPrice values never
    /// touch that text: they are collected into <c>args</c> and handed to
    /// FromSqlRaw's own parameter substitution ({0}, {1}, ...), which binds them as
    /// real Npgsql parameters. So even though the predicate is built dynamically,
    /// values are never string-concatenated into the query and this is not
    /// SQL-injectable.
    /// </summary>
    public Task<List<Product>> SearchAsync(string? category, decimal? minPrice, CancellationToken ct = default)
    {
        const string template = "SELECT * FROM \"Products\" p WHERE {0}";

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

        // No filters supplied -> unconditional predicate; still goes through the
        // same parameterized FromSqlRaw call as the filtered cases.
        var whereClause = conditions.Count > 0 ? string.Join(" AND ", conditions) : "1 = 1";
        var sql = string.Format(template, whereClause);

        return _db.Products.FromSqlRaw(sql, args.ToArray()).ToListAsync(ct);
    }
}

/// <summary>
/// Thrown by <see cref="ProductRepository.ReserveAsync"/> when there isn't enough
/// stock left to satisfy a reservation.
/// </summary>
public class InsufficientStockException : Exception
{
    public Guid ProductId { get; }
    public int Requested { get; }
    public int Available { get; }

    public InsufficientStockException(Guid productId, int requested, int available)
        : base($"Cannot reserve {requested} unit(s) of product {productId}: only {available} in stock.")
    {
        ProductId = productId;
        Requested = requested;
        Available = available;
    }
}
