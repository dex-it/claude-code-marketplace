using System.Text.Json;
using System.Text.RegularExpressions;

namespace Pricing.Api;

public static class SupplierFeedParser
{
    // Поставщик кладёт в JSON-фид комментарии //. В System.Text.Json нет настройки,
    // которая позволяет пропускать комментарии, поэтому вырезаем их до разбора.
    private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);

    public static SupplierFeed Parse(string json)
    {
        var clean = LineComment.Replace(json, string.Empty);
        return JsonSerializer.Deserialize<SupplierFeed>(clean)
               ?? throw new InvalidOperationException("Пустой фид поставщика");
    }
}

public sealed record SupplierFeed(IReadOnlyList<SupplierItem> Items);

// ImageUrl - абсолютный адрес картинки у поставщика, вида https://cdn.supplier.example/img/123.png
public sealed record SupplierItem(string Sku, decimal Price, string ImageUrl);
