namespace Shop.Data;

// Thrown when UpdateOrder detects that the order was changed by another
// operator between this caller's read and this caller's write.
public class OrderConcurrencyConflictException : Exception
{
    public Guid OrderId { get; }
    public OrderConcurrencyConflictException(Guid orderId, Exception inner)
        : base($"Order {orderId} was modified by another operator concurrently. Reload and retry.", inner)
        => OrderId = orderId;
}

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // Operators in the admin UI edit orders concurrently (typically each edit is
    // a separate request against a freshly created DbContext, so `order` arrives
    // detached). `order.Version` must be the xmin the operator's screen last read.
    //
    // We reload the current row into this DbContext (so EF has the real current
    // values/original values for every other tracked property), then override
    // just the concurrency token's OriginalValue with what the caller actually
    // saw. If another operator committed a change in between, the current xmin
    // in the database no longer matches that value, the UPDATE ... WHERE xmin = @original
    // affects zero rows, and EF surfaces DbUpdateConcurrencyException instead of
    // silently overwriting the other operator's write (last-write-wins).
    public async Task UpdateOrderAsync(Order order)
    {
        var tracked = await _db.Orders.FirstOrDefaultAsync(o => o.Id == order.Id)
            ?? throw new InvalidOperationException($"Order {order.Id} not found");

        _db.Entry(tracked).Property(o => o.Version).OriginalValue = order.Version;

        tracked.Status = order.Status;
        tracked.Category = order.Category;
        tracked.Total = order.Total;
        tracked.ShippedAt = order.ShippedAt;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new OrderConcurrencyConflictException(order.Id, ex);
        }
    }
}
