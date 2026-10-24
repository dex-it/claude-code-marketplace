namespace Shop.Data;

public enum OrderUpdateResult { Success, NotFound }

// Thrown by UpdateOrderAsync when another operator already saved changes to the same order
// (its xmin no longer matches the value the caller read). The admin UI is expected to catch
// this, reload the current order and ask the operator to reapply their changes, rather than
// silently overwrite someone else's edit (lost update).
public class OrderConcurrencyConflictException : Exception
{
    public Guid OrderId { get; }
    public OrderConcurrencyConflictException(Guid orderId, Exception inner)
        : base($"Order {orderId} was changed by another operator in the meantime; reload and retry.", inner)
        => OrderId = orderId;
}

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;

    // Read-only fetches used for display: no change tracking needed.
    public Task<List<Order>> GetAllAsync() => _db.Orders.AsNoTracking().ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);

    // Persists edits an operator made to a previously-loaded (disconnected) Order.
    // `order.RowVersion` must be the value that was handed to the operator together with the
    // order being edited (i.e. from a prior GetAsync). We set it as the tracked entity's
    // *original* RowVersion value, so EF adds "AND xmin = @original" to the UPDATE statement.
    // If another operator saved a change to this order first, the row's xmin has since moved
    // on, the UPDATE matches zero rows, and EF raises DbUpdateConcurrencyException instead of
    // silently overwriting the other operator's edit.
    public async Task<OrderUpdateResult> UpdateOrderAsync(Order order)
    {
        var existing = await _db.Orders.FirstOrDefaultAsync(o => o.Id == order.Id);
        if (existing is null) return OrderUpdateResult.NotFound;

        _db.Entry(existing).Property(o => o.RowVersion).OriginalValue = order.RowVersion;

        existing.Status = order.Status;
        existing.Category = order.Category;
        existing.Total = order.Total;
        existing.ShippedAt = order.ShippedAt;

        try
        {
            await _db.SaveChangesAsync();
            return OrderUpdateResult.Success;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new OrderConcurrencyConflictException(order.Id, ex);
        }
    }
}
