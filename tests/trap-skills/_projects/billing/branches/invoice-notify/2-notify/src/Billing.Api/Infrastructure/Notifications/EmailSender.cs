using System.Net.Http.Json;
using Billing.Api.Application.Notifications;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class EmailSender(HttpClient http, ILogger logger)
{
    public async Task SendInvoiceIssuedAsync(CustomerProfile profile, InvoiceIssuedNotification n, CancellationToken ct)
    {
        var amount = $"{n.Amount.Minor / 100m:0.00} {n.Amount.Currency}";
        var text = $"Выставлен счёт {n.InvoiceId} на {amount}, оплатить до {n.DueDate:dd.MM.yyyy}.";
        using var response = await http.PostAsJsonAsync("v1/messages", new { to = profile.Email, subject = "Новый счёт", text }, ct);
        response.EnsureSuccessStatusCode();
        logger.LogDebug("Invoice email accepted by mail gateway for {InvoiceId}", n.InvoiceId);
    }
}
