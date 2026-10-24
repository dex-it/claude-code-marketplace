using System.Net;
using System.Net.Http.Json;
using Pricing.Application.Abstractions;

namespace Pricing.Infrastructure.Suppliers;

public sealed class SupplierApiClient(HttpClient http) : ISupplierCatalog
{
    private sealed record PriceResponse(string Sku, decimal Price, string Currency);

    public async Task<SupplierPrice?> GetPriceAsync(string supplierId, string sku, CancellationToken ct)
    {
        using var response = await http.GetAsync($"v1/suppliers/{supplierId}/prices/{Uri.EscapeDataString(sku)}", ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PriceResponse>(ct)
            ?? throw new InvalidOperationException("Пустой ответ Supplier API");
        return new SupplierPrice(body.Sku, body.Price, body.Currency);
    }
}
