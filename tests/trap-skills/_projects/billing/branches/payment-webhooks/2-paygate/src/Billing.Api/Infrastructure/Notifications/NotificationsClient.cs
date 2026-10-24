using System.Net.Http.Json;
using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class NotificationsOptions
{
    public string BaseUrl { get; set; } = "";
}

public sealed class NotificationsClient(HttpClient http) : INotificationsClient
{
    public async Task SendReceiptAsync(string email, Receipt receipt, CancellationToken ct)
    {
        var response = await http.PostAsJsonAsync("v1/emails", new
        {
            to = email,
            template = "payment-receipt",
            data = new { invoiceId = receipt.InvoiceId.Value, amountMinor = receipt.AmountMinor, currency = receipt.Currency },
        }, ct);
        response.EnsureSuccessStatusCode();
    }
}
