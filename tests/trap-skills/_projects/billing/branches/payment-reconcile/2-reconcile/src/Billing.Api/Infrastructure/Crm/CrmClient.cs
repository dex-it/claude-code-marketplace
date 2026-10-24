using System.Net.Http.Json;

namespace Billing.Api.Infrastructure.Crm;

public sealed record CustomerContacts(Guid CustomerId, string Email, string Phone);
public sealed record MismatchReport(DateOnly Day, IReadOnlyList<string> Lines);

public sealed class CrmClient(HttpClient http)
{
    public async Task<CustomerContacts> GetContactsAsync(Guid customerId, CancellationToken ct) =>
        (await http.GetFromJsonAsync<CustomerContacts>($"v1/customers/{customerId}/contacts", ct))!;

    public async Task ReportMismatchAsync(MismatchReport report, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("v1/finance/reconciliation", report, ct);
        response.EnsureSuccessStatusCode();
    }

    public async Task SendReminderAsync(CustomerContacts contacts, string text, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("v1/messages", new { contacts.Email, contacts.Phone, text }, ct);
        response.EnsureSuccessStatusCode();
    }
}
