namespace Pricing.Application.Abstractions;

public sealed record SupplierPrice(string Sku, decimal Price, string Currency);

public interface ISupplierCatalog
{
    /// <summary>Текущая цена поставщика; null - поставщик SKU не знает.</summary>
    Task<SupplierPrice?> GetPriceAsync(string supplierId, string sku, CancellationToken ct);
}
