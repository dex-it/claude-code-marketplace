using System.Net.Http.Json;
using Billing.Api.Application.Abstractions;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class MailerNotificationSender(HttpClient http) : INotificationSender
{
    public async Task SendAsync(NotificationRequest request, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("v1/messages", request, ct);
        response.EnsureSuccessStatusCode();
    }
}
