using System.Net.Http.Json;
using Pricing.Application.Abstractions;

namespace Pricing.Infrastructure.Suppliers;

public sealed class SupplierPriceBatchClient(HttpClient http) : ISupplierPriceBatch
{
    private sealed record BatchRequest(IReadOnlyList<string> Skus);
    private sealed record PriceResponse(string Sku, decimal Price, string Currency);

    public async Task<IReadOnlyList<SupplierPrice>> GetPricesAsync(string supplierId, IReadOnlyList<string> skus, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync($"v1/suppliers/{supplierId}/prices:batch", new BatchRequest(skus), ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<List<PriceResponse>>(ct) ?? [];
        return body.Select(p => new SupplierPrice(p.Sku, p.Price, p.Currency)).ToList();
    }
}
