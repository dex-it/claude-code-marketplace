using System.Net.Http.Json;

namespace Billing.Api.Infrastructure.Reconciliation;

public sealed record LedgerReportEntry(string ExternalId, long AmountMinor, string Currency, DateTimeOffset PostedAt);

public sealed class LedgerReportClient(HttpClient http, ILogger<LedgerReportClient> logger)
{
    public async Task<IReadOnlyList<LedgerReportEntry>> GetEntriesAsync(string account, DateOnly day, CancellationToken ct)
    {
        logger.LogInformation("GetEntriesAsync started for {Account} {Day}", account, day);
        var entries = await http.GetFromJsonAsync<List<LedgerReportEntry>>($"v1/accounts/{account}/entries?day={day:yyyy-MM-dd}", ct) ?? [];
        logger.LogInformation("GetEntriesAsync finished for {Account} {Day}", account, day);
        return entries;
    }
}
