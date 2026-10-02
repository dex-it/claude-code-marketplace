using Microsoft.EntityFrameworkCore;

namespace Shop;

public record ImportResult(int Updated, int Unknown, int Invalid);

public class StockImport
{
    private readonly ShopDbContext _db;
    public StockImport(ShopDbContext db) => _db = db;

    // Файл остатков от поставщика: строка "productId;qty", первая строка - заголовок.
    public async Task<ImportResult> Import(string csvPath, CancellationToken ct = default)
    {
        var products = await _db.Products.ToListAsync(ct);
        int updated = 0, unknown = 0, invalid = 0;

        foreach (var line in File.ReadLines(csvPath).Skip(1))
        {
            var parts = line.Split(';');
            if (parts.Length != 2 || !Guid.TryParse(parts[0], out var id) || !int.TryParse(parts[1], out var qty))
            {
                invalid++;
                continue;
            }

            var product = products.FirstOrDefault(p => p.Id == id);
            if (product is null)
            {
                unknown++;
                continue;
            }

            product.Stock = qty;
            updated++;
        }

        await _db.SaveChangesAsync(ct);
        return new ImportResult(updated, unknown, invalid);
    }
}
