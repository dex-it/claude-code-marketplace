using System.Net.Http.Json;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Edo;

public sealed record EdoDocumentRequest(
    string ExternalId, Guid CustomerId, long AmountMinor, string Currency, DateOnly DueDate);

public sealed record SendEdoDocumentResponse(string DocumentId);

public sealed class HttpJsonPoster(HttpClient http)
{
    public Task<EdoDocumentRequest> BuildPayloadAsync(Invoice invoice, CancellationToken ct) =>
        Task.FromResult(new EdoDocumentRequest(
            $"invoice-{invoice.Id}",
            invoice.CustomerId.Value,
            invoice.Amount.Minor,
            invoice.Amount.Currency,
            invoice.DueDate));

    public async Task<string> PostAsync(EdoDocumentRequest payload, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("v2/documents", payload, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<SendEdoDocumentResponse>(ct);
        return body!.DocumentId;
    }
}
