using System.Net.Http.Json;

namespace Shop.Api.Notifications;

public sealed class ReturnNotifier(HttpClient http, ILogger<ReturnNotifier> log)
{
    public Task ReturnCreatedAsync(int returnId, CancellationToken ct) =>
        SendAsync(EmailTemplates.ReturnCreated, new { returnId }, ct);

    public Task ReturnRefundedAsync(int returnId, decimal amount, CancellationToken ct) =>
        SendAsync(EmailTemplates.ReturnRefunded, new { returnId, amount }, ct);

    public Task ReturnRejectedAsync(int returnId, CancellationToken ct) =>
        SendAsync(EmailTemplates.ReturnRejected, new { returnId }, ct);

    private async Task SendAsync(string template, object model, CancellationToken ct)
    {
        try
        {
            var resp = await http.PostAsJsonAsync($"templates/{template}/send", model, ct);
            resp.EnsureSuccessStatusCode();
        }
        catch (HttpRequestException ex)
        {
            log.LogWarning(ex, "Notification {Template} failed", template);
        }
    }
}
