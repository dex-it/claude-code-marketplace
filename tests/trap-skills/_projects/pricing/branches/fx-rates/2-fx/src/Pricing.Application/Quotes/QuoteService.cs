using Pricing.Application.Abstractions;
using Pricing.Application.Promotions;
using Pricing.Domain;

namespace Pricing.Application.Quotes;

public sealed record QuoteLine(string Sku, int Quantity);

public sealed record QuotedLine(string Sku, int Quantity, decimal UnitPrice, decimal Total);

public sealed record Quote(IReadOnlyList<QuotedLine> Lines, decimal Total, string Currency);

public sealed class QuoteService(
    IProductRepository products, ISupplierCatalog suppliers, PromotionService promotions, CurrencyConverter currency)
{
    public async Task<Quote> QuoteAsync(IReadOnlyList<QuoteLine> lines, CancellationToken ct)
    {
        var quoted = new List<QuotedLine>();
        foreach (var line in lines)
        {
            var product = await products.GetBySkuAsync(line.Sku, ct)
                ?? throw new NotFoundException("product.not_found", $"SKU {line.Sku} не найден");
            var supplier = await suppliers.GetPriceAsync(product.SupplierId, product.Sku, ct);
            var supplierRub = supplier is null ? 0m : await currency.ToRubAsync(supplier.Price, supplier.Currency, ct);
            var unit = Math.Max(product.BasePrice, supplierRub);
            var discount = await promotions.CurrentDiscountAsync(product.Category, ct);
            unit = Math.Round(unit * (1 - discount / 100m), 2);
            quoted.Add(new QuotedLine(line.Sku, line.Quantity, unit, unit * line.Quantity));
        }
        return new Quote(quoted, quoted.Sum(l => l.Total), "RUB");
    }
}
