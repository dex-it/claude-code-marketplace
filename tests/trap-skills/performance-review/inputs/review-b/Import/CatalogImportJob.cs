using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Catalog.Worker.Data;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Worker.Import;

public sealed class CatalogImportJob(CatalogDbContext db, ILogger<CatalogImportJob> logger)
{
    private static readonly Regex DescriptionPattern = new(@"^([\p{L}\p{N}]+[ ,.-]?)*$", RegexOptions.Compiled);
    private static readonly string[] Currencies = ["RUB", "USD", "EUR"];

    public async Task RunAsync(string path, CancellationToken ct)
    {
        var text = File.ReadAllText(path);
        var existingSkus = await db.Products.Select(p => p.Sku).ToListAsync(ct);
        var skipped = "";
        var imported = 0;

        foreach (var line in text.Split('\n').Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = line.TrimEnd('\r').Split(';');
            var sku = cols[0].Trim();

            var skuFormat = new Regex(@"^[A-Z]{3}-\d{6}$");
            if (!skuFormat.IsMatch(sku) || !DescriptionPattern.IsMatch(cols[2]))
            {
                skipped += sku + ",";
                continue;
            }
            if (existingSkus.Contains(sku)) continue;
            if (!Currencies.Contains(cols[4]))
            {
                skipped += sku + ",";
                continue;
            }

            var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var attributes = JsonSerializer.Deserialize<Dictionary<string, string>>(cols[5], jsonOptions);
            var culture = new CultureInfo("ru-RU");

            db.Products.Add(new Product
            {
                Sku = sku,
                Name = cols[1],
                Description = cols[2],
                Price = decimal.Parse(cols[3], culture),
                Currency = cols[4],
                Attributes = attributes,
            });
            await db.SaveChangesAsync(ct);
            imported++;
        }

        logger.LogInformation("Catalog import: {Imported} imported, skipped: {Skipped}", imported, skipped);
    }
}
