namespace Pricing.Application.Abstractions;

public interface IRates
{
    /// <summary>Сколько рублей стоит единица валюты.</summary>
    Task<decimal> RubPerUnitAsync(string currency, CancellationToken ct);
}

public interface ISupplierPriceBatch
{
    Task<IReadOnlyList<SupplierPrice>> GetPricesAsync(string supplierId, IReadOnlyList<string> skus, CancellationToken ct);
}
