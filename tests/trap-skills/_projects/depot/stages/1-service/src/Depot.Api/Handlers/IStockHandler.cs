using Depot.Contracts;

namespace Depot.Api.Handlers;

public interface IStockHandler
{
    Task OnReceivedAsync(string sku, ReceiveRequest request);
}

public sealed class AuditHandler(ILogger<AuditHandler> log) : IStockHandler
{
    public Task OnReceivedAsync(string sku, ReceiveRequest request)
    {
        log.LogInformation("received {Sku} x{Qty} to {Wh}", sku, request.Quantity, request.Warehouse);
        return Task.CompletedTask;
    }
}
