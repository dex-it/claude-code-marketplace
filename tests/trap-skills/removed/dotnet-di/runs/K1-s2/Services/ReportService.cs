using Microsoft.Extensions.DependencyInjection;

namespace Notify.Api.Services;

public sealed class ReportService
{
    private readonly INotificationSender _sender;

    public ReportService([FromKeyedServices(NotificationSenderKeys.Email)] INotificationSender sender)
        => _sender = sender;

    public Task SendAsync(Guid reportId, string recipientEmail, CancellationToken ct = default)
        => _sender.SendAsync(recipientEmail, $"Отчёт {reportId} готов", ct);
}
