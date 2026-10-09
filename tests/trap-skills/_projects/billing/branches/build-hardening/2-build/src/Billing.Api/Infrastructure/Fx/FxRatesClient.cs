namespace Billing.Api.Infrastructure.Fx;

public sealed class FxRatesClient(HttpClient http)
{
    public async Task<decimal> GetRateAsync(string from, string to, CancellationToken ct)
    {
        var response = await http.GetFromJsonAsync<RateResponse>($"v1/rates/{from}/{to}", ct);
        return response!.Rate;
    }

    private sealed record RateResponse(decimal Rate);
}
