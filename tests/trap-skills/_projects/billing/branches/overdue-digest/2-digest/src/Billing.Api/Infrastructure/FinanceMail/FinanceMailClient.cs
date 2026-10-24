using System.Net.Http.Json;

namespace Billing.Api.Infrastructure.FinanceMail;

public sealed record OverdueDigest(DateOnly Day, int Count, IReadOnlyDictionary<string, long> TotalMinorByCurrency, IReadOnlyList<Guid> Oldest);

public sealed class FinanceMailClient(HttpClient http)
{
    public async Task<IReadOnlyList<string>> GetRecipientsAsync(CancellationToken ct) =>
        await http.GetFromJsonAsync<List<string>>("v1/finance/recipients", ct) ?? [];

    public async Task SendDigestAsync(OverdueDigest digest, IReadOnlyList<string> recipients, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("v1/finance/digests", new { digest, recipients }, ct);
        response.EnsureSuccessStatusCode();
    }
}
