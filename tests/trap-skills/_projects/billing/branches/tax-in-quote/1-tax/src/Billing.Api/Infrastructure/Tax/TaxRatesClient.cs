using System.Net.Http.Json;

namespace Billing.Api.Infrastructure.Tax;

public sealed class TaxRatesClient(HttpClient http)
{
    public async Task<decimal> GetVatRateAsync(string country, CancellationToken ct)
    {
        var response = await http.GetFromJsonAsync<VatResponse>($"v1/vat/{country}", ct);
        return response!.Rate;
    }

    private sealed record VatResponse(decimal Rate);
}
