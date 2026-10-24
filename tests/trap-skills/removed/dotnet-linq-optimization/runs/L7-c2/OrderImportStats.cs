namespace Shop;

public record OrderImportStats(
    int OrderCount,
    decimal TotalSum,
    DateTime? EarliestOrderDate,
    int UniqueCustomerCount)
{
    // Один проход по File.ReadLines: файл до нескольких ГБ, повторное перечисление Read(path) недопустимо.
    public static OrderImportStats Compute(string path)
    {
        var count = 0;
        var totalSum = 0m;
        DateTime? earliest = null;
        var customers = new HashSet<string>();

        foreach (var line in OrderFileReader.Read(path))
        {
            count++;
            totalSum += line.Total;
            if (earliest is null || line.CreatedAt < earliest)
                earliest = line.CreatedAt;
            customers.Add(line.CustomerEmail);
        }

        return new OrderImportStats(count, totalSum, earliest, customers.Count);
    }
}
