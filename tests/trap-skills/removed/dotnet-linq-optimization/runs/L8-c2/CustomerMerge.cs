using System.Text.Json;

namespace Shop;

public static class CustomerMerge
{
    // Файл целиком - JSON-массив Customer (не JSON Lines, как в OrderFileReader).
    public static List<Customer> Merge(string exportPathA, string exportPathB)
    {
        var a = ReadCustomers(exportPathA);
        var b = ReadCustomers(exportPathB);

        // Дедуп по Id - первичному идентификатору Customer, не по Email.
        return a.Concat(b)
            .GroupBy(c => c.Id)
            .Select(g => g.First())
            .ToList();
    }

    private static List<Customer> ReadCustomers(string path)
    {
        using var stream = File.OpenRead(path);
        return JsonSerializer.Deserialize<List<Customer>>(stream) ?? new List<Customer>();
    }
}
