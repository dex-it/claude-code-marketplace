using System.Net.Http.Json;

namespace Orders.Api.Services;

public interface IRateService
{
    Task<decimal> GetRateAsync(string currency);
}

public sealed class RateService(HttpClient http) : IRateService
{
    public async Task<decimal> GetRateAsync(string currency)
    {
        var dto = await http.GetFromJsonAsync<RateDto>($"rates/{currency}");
        return dto!.Rate;
    }

    private sealed record RateDto(string Currency, decimal Rate);
}
