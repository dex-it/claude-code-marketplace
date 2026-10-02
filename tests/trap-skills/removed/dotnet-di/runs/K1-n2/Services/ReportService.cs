using Microsoft.Extensions.DependencyInjection;

namespace Notify.Api.Services;

public sealed class ReportService
{
    private readonly INotificationSender _sender;
    public ReportService([FromKeyedServices("email")] INotificationSender sender) => _sender = sender;

    public Task SendAsync(Guid reportId, string email, CancellationToken ct = default)
        => _sender.SendAsync(email, $"Отчёт {reportId} отправлен", ct);
}
