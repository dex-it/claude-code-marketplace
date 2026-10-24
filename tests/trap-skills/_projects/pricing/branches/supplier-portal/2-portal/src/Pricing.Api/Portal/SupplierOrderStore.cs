using System.Collections.Concurrent;
using Pricing.Domain;

namespace Pricing.Api.Portal;

public sealed class SupplierOrderStore
{
    public ConcurrentDictionary<Guid, SupplierOrder> Orders { get; } = new();
}

public interface IOrderNotifier
{
    Task NotifyConfirmedAsync(SupplierOrder order, CancellationToken ct);
}

public sealed class EmailOrderNotifier(ILogger<EmailOrderNotifier> log) : IOrderNotifier
{
    public Task NotifyConfirmedAsync(SupplierOrder order, CancellationToken ct)
    {
        log.LogInformation("Заказ {Number} поставщика {SupplierId} подтверждён", order.Number, order.SupplierId);
        return Task.CompletedTask;
    }
}
