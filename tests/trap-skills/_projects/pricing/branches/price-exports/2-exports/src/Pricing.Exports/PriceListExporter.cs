using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using Pricing.Application.Abstractions;
using Pricing.Domain;

namespace Pricing.Exports;

public sealed record PriceRow(string Sku, string Name, Category Category, decimal Price);

public sealed class PriceListExporter(IProductRepository products)
{
    public async Task ExportAsync(TextWriter output, CancellationToken ct)
    {
        var all = await products.ListAsync(0, int.MaxValue, ct);
        var config = new CsvConfiguration(CultureInfo.CurrentCulture) { Delimiter = ";" };
        await using var csv = new CsvWriter(output, config, leaveOpen: true);
        await csv.WriteRecordsAsync(all.Where(p => !p.IsArchived).Select(ToRow), ct);
    }

    private static PriceRow ToRow(Product p) => new(p.Sku, p.Name, p.Category, p.BasePrice);
}
