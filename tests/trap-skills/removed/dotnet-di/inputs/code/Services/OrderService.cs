namespace Notify.Api.Services;

public sealed class OrderService
{
    private readonly INotificationSender _sender;
    public OrderService(INotificationSender sender) => _sender = sender;

    public Task ConfirmAsync(Guid orderId, string customerEmail, CancellationToken ct = default)
        => _sender.SendAsync(customerEmail, $"Заказ {orderId} подтверждён", ct);
}
