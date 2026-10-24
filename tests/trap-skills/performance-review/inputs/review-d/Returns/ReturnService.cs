using Shop.Api.Data;
using Shop.Api.Infrastructure;
using Shop.Api.Notifications;
using Shop.Api.Orders;

namespace Shop.Api.Returns;

public sealed class ReturnService(
    ShopDbContext db,
    OrderLookup orders,
    ReturnValidator validator,
    RefundGateway refunds,
    ReturnNotifier notifier,
    IClock clock)
{
    public async Task<(ReturnRequest? Created, IReadOnlyList<string> Errors)> CreateAsync(
        int tenantId, CreateReturnCommand cmd, CancellationToken ct)
    {
        var order = await orders.FindAsync(tenantId, cmd.OrderId, ct);
        if (order is null)
            return (null, new[] { "Заказ не найден" });

        var errors = await validator.ValidateAsync(cmd, order, ct);
        if (errors.Count > 0)
            return (null, errors);

        var request = new ReturnRequest
        {
            TenantId = tenantId,
            OrderId = order.Id,
            Reason = cmd.Reason.Trim(),
            Status = ReturnStatus.Requested,
            CreatedAt = clock.UtcNow,
            Lines = cmd.Lines.Select(l => new ReturnLine { OrderLineId = l.OrderLineId, Quantity = l.Quantity }).ToList(),
        };
        db.ReturnRequests.Add(request);
        await db.SaveChangesAsync(ct);

        await notifier.ReturnCreatedAsync(request.Id, ct);
        return (request, Array.Empty<string>());
    }

    public async Task<bool> ApproveAsync(int tenantId, int id, CancellationToken ct)
    {
        var request = await db.ReturnRequests.FindAsync(new object[] { id }, ct);
        if (request is null || request.TenantId != tenantId || request.Status != ReturnStatus.Requested)
            return false;

        var amount = request.Lines.Sum(l =>
            request.Order.Lines.First(ol => ol.Id == l.OrderLineId).UnitPrice * l.Quantity);

        request.RefundExternalId = await refunds.RefundAsync(request.OrderId, amount, ct);
        request.Status = ReturnStatus.Refunded;
        await db.SaveChangesAsync(ct);

        await notifier.ReturnRefundedAsync(request.Id, amount, ct);
        return true;
    }

    public async Task<bool> RejectAsync(int tenantId, int id, CancellationToken ct)
    {
        var request = await db.ReturnRequests.FindAsync(new object[] { id }, ct);
        if (request is null || request.TenantId != tenantId || request.Status != ReturnStatus.Requested)
            return false;

        request.Status = ReturnStatus.Rejected;
        await db.SaveChangesAsync(ct);
        await notifier.ReturnRejectedAsync(request.Id, ct);
        return true;
    }
}
