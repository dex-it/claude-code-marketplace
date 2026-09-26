using System.Text.Json;

namespace Shop;

public static class CustomerMerge
{
    public static List<Customer> Merge(string exportPathA, string exportPathB)
    {
        var customers = ReadCustomers(exportPathA).Concat(ReadCustomers(exportPathB));

        // Id — идентичность клиента; при совпадении Id в обоих файлах побеждает первая встреченная запись.
        return customers
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
