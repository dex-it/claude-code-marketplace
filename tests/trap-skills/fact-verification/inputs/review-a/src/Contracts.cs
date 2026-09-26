namespace Pricing.Api;

public interface ISupplierClient
{
    // API поставщика: не больше 5 запросов в секунду на ключ; превышение - бан ключа на час.
    Task<decimal> GetPriceAsync(string sku, CancellationToken ct);
}

public interface ICatalogRepository
{
    Task<CatalogPage> LoadPageAsync(int page, CancellationToken ct);
}

public sealed record CatalogPage(int Page, IReadOnlyList<string> Skus);
