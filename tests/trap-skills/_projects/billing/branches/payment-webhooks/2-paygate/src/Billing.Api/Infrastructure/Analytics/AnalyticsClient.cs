using System.Net.Http.Json;
using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Analytics;

public sealed class AnalyticsOptions
{
    public string BaseUrl { get; set; } = "";
}

public sealed class AnalyticsClient(HttpClient http) : IAnalyticsClient
{
    public async Task PushInvoicePaidAsync(Invoice invoice, CancellationToken ct)
    {
        var response = await http.PostAsJsonAsync("v1/events/invoice-paid", invoice, ct);
        response.EnsureSuccessStatusCode();
    }
}
