using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    /// <summary>
    /// Saves edits made by an admin operator to an order, guarding against a second
    /// operator having saved a conflicting change to the same order in the meantime.
    ///
    /// <paramref name="edited"/> is the order the operator loaded earlier (via
    /// GetAsync, in a request/scope of its own) with fields changed on it, including
    /// the <see cref="Order.Version"/> it was loaded with. Because two operators can
    /// load and edit the same order in parallel, a plain "load fresh, overwrite
    /// columns, save" would let the second save silently clobber the first one's
    /// changes (last-writer-wins). Instead this attaches a stub tracked by the
    /// current context, applies only the editable fields, and pins the concurrency
    /// token's *original* value to what the operator actually read. EF Core then
    /// emits "UPDATE ... WHERE "Id" = @id AND xmin = @original_version", so if the
    /// row was already updated by someone else, zero rows match and EF raises
    /// DbUpdateConcurrencyException, which is surfaced here as
    /// <see cref="OrderConcurrencyConflictException"/> so the caller can reload the
    /// current state and ask the operator to redo/merge their edit instead of
    /// silently losing it.
    /// </summary>
    public async Task UpdateOrderAsync(Order edited, CancellationToken ct = default)
    {
        var tracked = new Order { Id = edited.Id };
        _db.Attach(tracked);

        // Apply only the fields an admin operator is allowed to edit.
        tracked.Status = edited.Status;
        tracked.Category = edited.Category;
        tracked.Total = edited.Total;
        tracked.ShippedAt = edited.ShippedAt;

        // Tell EF Core what row version this edit was based on, so the UPDATE's
        // WHERE clause checks against it rather than whatever is currently in the
        // database (which is what a bare Attach + SaveChanges would do).
        _db.Entry(tracked).Property(o => o.Version).OriginalValue = edited.Version;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new OrderConcurrencyConflictException(edited.Id, ex);
        }
    }
}

/// <summary>
/// Thrown by <see cref="OrderRepository.UpdateOrderAsync"/> when the order was
/// modified by another operator between the moment it was loaded for editing and
/// the moment this save was attempted. Callers should reload the order, surface the
/// conflict to the operator, and let them redo/merge their change.
/// </summary>
public class OrderConcurrencyConflictException : Exception
{
    public Guid OrderId { get; }

    public OrderConcurrencyConflictException(Guid orderId, Exception inner)
        : base($"Order {orderId} was modified by another user before this change could be saved.", inner)
        => OrderId = orderId;
}
