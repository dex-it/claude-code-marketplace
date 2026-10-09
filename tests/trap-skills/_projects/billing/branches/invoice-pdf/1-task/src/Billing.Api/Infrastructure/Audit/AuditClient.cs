using System.Net.Http.Json;

namespace Billing.Api.Infrastructure.Audit;

public sealed record AuditRecord(string Actor, string Action, string Subject, DateTimeOffset At);

public sealed class AuditClient(HttpClient http)
{
    public async Task WriteAsync(AuditRecord record, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("v1/records", record, ct);
        response.EnsureSuccessStatusCode();
    }
}
