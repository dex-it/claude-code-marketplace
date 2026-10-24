using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Acme.Ledger.Client;

public sealed class LedgerEntry
{
    public required string ExternalId { get; init; }
    public required string Account { get; init; }
    public required long AmountMinor { get; init; }
    public required string Currency { get; init; }
    public string? Description { get; init; }
}

public sealed class LedgerUnavailableException(HttpStatusCode status)
    : Exception($"Ledger unavailable: {(int)status}")
{
    public HttpStatusCode Status { get; } = status;
}

public sealed class LedgerRejectedException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed class LedgerClient
{
    private readonly HttpClient _http;

    public LedgerClient(HttpClient http) => _http = http;

    public async Task<string> PostEntryAsync(LedgerEntry entry, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "v2/entries");
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        request.Content = JsonContent.Create(new EntryBody(
            entry.ExternalId, entry.Account, entry.AmountMinor, entry.Currency, entry.Description));

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (response.StatusCode is HttpStatusCode.ServiceUnavailable or HttpStatusCode.TooManyRequests)
            throw new LedgerUnavailableException(response.StatusCode);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadFromJsonAsync<ErrorBody>(cancellationToken).ConfigureAwait(false);
            throw new LedgerRejectedException(error?.Code ?? "unknown", error?.Message ?? response.ReasonPhrase ?? "");
        }

        var created = await response.Content.ReadFromJsonAsync<CreatedBody>(cancellationToken).ConfigureAwait(false);
        return created!.EntryId;
    }

    private sealed record EntryBody(
        [property: JsonPropertyName("external_ref")] string ExternalRef,
        [property: JsonPropertyName("account")] string Account,
        [property: JsonPropertyName("amount_minor")] long AmountMinor,
        [property: JsonPropertyName("currency")] string Currency,
        [property: JsonPropertyName("description")] string? Description);

    private sealed record ErrorBody(
        [property: JsonPropertyName("code")] string Code,
        [property: JsonPropertyName("message")] string Message);

    private sealed record CreatedBody([property: JsonPropertyName("entry_id")] string EntryId);
}
