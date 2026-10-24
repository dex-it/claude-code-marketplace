using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only queries for orders/products. All queries are AsNoTracking (read-only, no change tracking overhead).
/// The <see cref="Order"/> soft-delete query filter (!IsDeleted) applies to every query here automatically,
/// since we query through ShopDbContext.Orders without IgnoreQueryFilters().
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (a) Order card: a single order by Id with all its items and payments.
    /// AsSplitQuery is used because Items and Payments are two sibling collections - a single query
    /// (JOIN-based) would multiply rows (cartesian explosion: items x payments per order).
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId, CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

    /// <summary>
    /// (b) All of a customer's orders with items and payments. A customer can have thousands of orders,
    /// so this streams results (IAsyncEnumerable) instead of buffering everything into a List up front -
    /// the caller consumes it with "await foreach" and rows are read incrementally from the connection.
    /// AsSplitQuery avoids the same cartesian-explosion problem as in GetOrderCardAsync, which matters even
    /// more here since it would otherwise multiply across thousands of orders at once.
    /// </summary>
    public IAsyncEnumerable<Order> GetCustomerOrdersAsync(Guid customerId, CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .OrderBy(o => o.CreatedAt)
            .AsAsyncEnumerable();

    /// <summary>
    /// (c) Product by SKU on a warehouse. The same SKU can exist on several warehouses, but SKU+warehouse
    /// is unique on one warehouse. Business currently may pass warehouse == null/empty:
    /// - if warehouse is given, at most one row can match (Sku, Warehouse) - unambiguous.
    /// - if warehouse is omitted, we still filter by Sku only. When that SKU happens to live on a single
    ///   warehouse, the result is unambiguous. When it lives on several warehouses, picking one silently
    ///   would be a data-correctness bug (wrong warehouse's stock/price), so we use SingleOrDefaultAsync:
    ///   it returns null when nothing matches, and throws InvalidOperationException when the SKU is
    ///   ambiguous without a warehouse, forcing the caller to supply one instead of getting a random row.
    /// </summary>
    public Task<Product?> GetProductBySkuAsync(string sku, string? warehouse, CancellationToken ct = default)
    {
        var query = _db.Products.AsNoTracking().Where(p => p.Sku == sku);
        if (!string.IsNullOrEmpty(warehouse))
            query = query.Where(p => p.Warehouse == warehouse);

        return query.SingleOrDefaultAsync(ct);
    }

    /// <summary>
    /// (d) Date of the customer's last shipped order. Returns a non-nullable DateTime by contract, so when
    /// the customer has no shipped orders (ShippedAt still null on all of them) there is no sensible default
    /// to fabricate - we throw rather than silently return DateTime.MinValue, which callers could otherwise
    /// mistake for a real shipping date. MaxAsync translates to a single SQL MAX(...) aggregate, so it never
    /// has to load matching orders into memory just to find the latest ShippedAt.
    /// </summary>
    public async Task<DateTime> GetLastShippedAtAsync(Guid customerId, CancellationToken ct = default)
    {
        var lastShippedAt = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null)
            .MaxAsync(o => (DateTime?)o.ShippedAt, ct);

        return lastShippedAt ?? throw new InvalidOperationException(
            $"Customer {customerId} has no shipped orders.");
    }
}
