using System.Text.Json;

namespace Shop;

public record OrderLine(Guid OrderId, string CustomerEmail, decimal Total, DateTime CreatedAt);

public static class OrderFileReader
{
    // Выгрузка из внешней системы: JSON Lines, файлы до нескольких ГБ.
    public static IEnumerable<OrderLine> Read(string path)
    {
        foreach (var line in File.ReadLines(path))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            yield return JsonSerializer.Deserialize<OrderLine>(line)!;
        }
    }
}
