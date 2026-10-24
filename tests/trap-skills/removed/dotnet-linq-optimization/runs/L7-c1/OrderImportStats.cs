namespace Shop;

public record OrderImportStats(int OrderCount, decimal TotalSum, DateTime? EarliestOrderDate, int UniqueCustomerCount)
{
    // Один проход по Read: файл до нескольких ГБ, второй foreach или ToList перечитывал бы его целиком.
    public static OrderImportStats Compute(string path)
    {
        var count = 0;
        var totalSum = 0m;
        DateTime? earliest = null;
        var emails = new HashSet<string>();

        foreach (var line in OrderFileReader.Read(path))
        {
            count++;
            totalSum += line.Total;
            if (earliest is null || line.CreatedAt < earliest)
                earliest = line.CreatedAt;
            emails.Add(line.CustomerEmail);
        }

        return new OrderImportStats(count, totalSum, earliest, emails.Count);
    }
}
