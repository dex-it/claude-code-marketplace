using Microsoft.Extensions.DependencyInjection;

namespace Notify.Api.Services;

public sealed class OrderService
{
    private readonly INotificationSender _sender;

    public OrderService([FromKeyedServices(NotificationSenderKeys.Sms)] INotificationSender sender)
        => _sender = sender;

    public Task ConfirmAsync(Guid orderId, string customerPhone, CancellationToken ct = default)
        => _sender.SendAsync(customerPhone, $"Заказ {orderId} подтверждён", ct);
}
