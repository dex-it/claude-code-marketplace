using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace Shop;

// Пакетный UPDATE ... FROM unnest(...) мимо EF change tracking - раунд-трип на батч, не на строку.
public class PriceImporter
{
    private const int BatchSize = 2000;

    private readonly ShopDbContext _db;
    public PriceImporter(ShopDbContext db) => _db = db;

    public async Task ImportPrices(string csvPath, IReadOnlyList<string> stopListSkus, CancellationToken ct = default)
    {
        // HashSet - O(1) проверка стоп-листа на каждую строку CSV.
        var stopList = new HashSet<string>(stopListSkus, StringComparer.Ordinal);

        // Dictionary: повтор SKU внутри батча схлопывается в одну запись (последняя по файлу выигрывает).
        var batch = new Dictionary<string, decimal>(BatchSize, StringComparer.Ordinal);

        var lineNumber = 0;
        foreach (var line in File.ReadLines(csvPath))
        {
            lineNumber++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            var separatorIndex = line.IndexOf(';');
            if (separatorIndex < 0)
                throw new InvalidDataException($"{csvPath}:{lineNumber}: ожидается формат 'sku;price', получено '{line}'");

            var sku = line[..separatorIndex].Trim();
            var priceText = line[(separatorIndex + 1)..].Trim();

            if (sku.Length == 0 || stopList.Contains(sku)) continue;

            if (!decimal.TryParse(priceText, NumberStyles.Number, CultureInfo.InvariantCulture, out var price))
                throw new InvalidDataException($"{csvPath}:{lineNumber}: некорректная цена '{priceText}' для SKU '{sku}'");

            batch[sku] = price;

            if (batch.Count >= BatchSize)
            {
                await FlushAsync(batch, ct);
                batch.Clear();
            }
        }

        if (batch.Count > 0)
            await FlushAsync(batch, ct);
    }

    private Task<int> FlushAsync(Dictionary<string, decimal> batch, CancellationToken ct)
    {
        var skus = batch.Keys.ToArray();
        var prices = batch.Values.ToArray();

        // unnest(arr1, arr2) в FROM - postgres-форма передачи набора пар одним параметризованным запросом.
        return _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE ""Products"" AS p
            SET ""Price"" = data.price
            FROM unnest({skus}::text[], {prices}::numeric[]) AS data(sku, price)
            WHERE p.""Sku"" = data.sku", ct);
    }
}
