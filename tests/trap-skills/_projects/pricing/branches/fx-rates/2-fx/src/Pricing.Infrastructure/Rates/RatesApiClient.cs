using System.Net.Http.Json;
using Pricing.Application.Abstractions;

namespace Pricing.Infrastructure.Rates;

public sealed class RatesOptions
{
    public const string Section = "Rates";
    public Uri BaseUrl { get; set; } = new("http://localhost:5200/");
}

public sealed class RatesApiClient(HttpClient http) : IRates
{
    private sealed record RateResponse(string Currency, decimal RubPerUnit);

    public async Task<decimal> RubPerUnitAsync(string currency, CancellationToken ct)
    {
        var rate = await http.GetFromJsonAsync<RateResponse>($"v1/rates/{currency}", ct)
            ?? throw new InvalidOperationException("Пустой ответ Rates API");
        return rate.RubPerUnit;
    }
}
