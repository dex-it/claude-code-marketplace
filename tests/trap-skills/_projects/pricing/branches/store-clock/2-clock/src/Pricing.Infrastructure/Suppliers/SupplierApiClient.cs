using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Pricing.Application.Abstractions;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace Pricing.Infrastructure.Suppliers;

public sealed class SupplierApiClient(HttpClient http, ILogger<SupplierApiClient> log) : ISupplierCatalog
{
    private sealed record PriceResponse(string Sku, decimal Price, string Currency);

    public async Task<SupplierPrice?> GetPriceAsync(string supplierId, string sku, CancellationToken ct)
    {
        try
        {
            using var response = await http.GetAsync($"v1/suppliers/{supplierId}/prices/{Uri.EscapeDataString(sku)}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<PriceResponse>(ct)
                ?? throw new InvalidOperationException("Пустой ответ Supplier API");
            return new SupplierPrice(body.Sku, body.Price, body.Currency);
        }
        catch (Exception ex) when (ex is TimeoutRejectedException or BrokenCircuitException
            || ex is HttpRequestException { StatusCode: null or HttpStatusCode.TooManyRequests or >= HttpStatusCode.InternalServerError })
        {
            // Сбой поставщика не роняет котировку (PRC-26); 4xx - ошибка контракта или ключа, её не глотаем.
            log.LogWarning(ex, "Supplier API не дал цену {Sku} поставщика {SupplierId}", sku, supplierId);
            return null;
        }
    }
}
