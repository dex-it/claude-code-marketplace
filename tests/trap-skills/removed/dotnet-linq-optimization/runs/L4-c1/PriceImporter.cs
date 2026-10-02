using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace Shop;

public class PriceImporter
{
    // Батч ограничивает память под цены CSV и размер ChangeTracker за один проход.
    private const int BatchSize = 2000;

    private readonly ShopDbContext _db;
    public PriceImporter(ShopDbContext db) => _db = db;

    public async Task ImportPrices(string csvPath, IReadOnlyList<string> stopListSkus, CancellationToken ct = default)
    {
        var stopList = new HashSet<string>(stopListSkus, StringComparer.Ordinal);

        foreach (var batch in ReadPriceBatches(csvPath, stopList, BatchSize))
        {
            if (batch.Count == 0) continue;

            var skus = batch.Keys.ToList();

            // Contains на List<string> уходит в Npgsql как "Sku" = ANY(@array), один round-trip на батч.
            var products = await _db.Products
                .Where(p => skus.Contains(p.Sku))
                .ToListAsync(ct);

            foreach (var product in products)
            {
                if (batch.TryGetValue(product.Sku, out var price))
                    product.Price = price;
            }

            await _db.SaveChangesAsync(ct);

            // Иначе ChangeTracker копит все обработанные Product до конца всего файла.
            _db.ChangeTracker.Clear();
        }
    }

    private static IEnumerable<Dictionary<string, decimal>> ReadPriceBatches(
        string csvPath, HashSet<string> stopList, int batchSize)
    {
        var batch = new Dictionary<string, decimal>(batchSize, StringComparer.Ordinal);

        foreach (var line in File.ReadLines(csvPath))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            var separatorIndex = line.IndexOf(';');
            if (separatorIndex < 0) continue;

            var sku = line[..separatorIndex].Trim();
            if (sku.Length == 0 || stopList.Contains(sku)) continue;

            var priceSpan = line.AsSpan(separatorIndex + 1).Trim();
            if (!decimal.TryParse(priceSpan, NumberStyles.Number, CultureInfo.InvariantCulture, out var price))
                continue;

            batch[sku] = price; // при дубле SKU в батче остаётся последняя строка

            if (batch.Count >= batchSize)
            {
                yield return batch;
                batch = new Dictionary<string, decimal>(batchSize, StringComparer.Ordinal);
            }
        }

        if (batch.Count > 0)
            yield return batch;
    }
}
