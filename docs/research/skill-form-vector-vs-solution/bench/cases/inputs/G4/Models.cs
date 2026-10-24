namespace Pixelwork.Timesheets;

public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}

public readonly record struct YearMonth(int Year, int Month)
{
    public static YearMonth Of(DateOnly date) => new(date.Year, date.Month);

    // 2026-09 -> 202609
    public int Key => Year * 100 + Month;
    public static YearMonth FromKey(int key) => new(key / 100, key % 100);

    public DateOnly FirstDay => new(Year, Month, 1);

    public override string ToString() => $"{Year:D4}-{Month:D2}";
}

public class Client : ISoftDeletable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public List<Project> Projects { get; set; } = new();
}

public class Project : ISoftDeletable
{
    public int Id { get; set; }
    public int ClientId { get; set; }
    public Client Client { get; set; } = null!;
    // Код из договора с клиентом, печатается в актах: ACME-042
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal HourlyRate { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public List<TimeEntry> Entries { get; set; } = new();
}

public class Employee
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
}

public class TimeEntry
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public DateOnly WorkDate { get; set; }
    public decimal Hours { get; set; }
    public string Comment { get; set; } = "";
}

// Месяц, за который с клиентами подписаны акты; часы закрытого месяца не меняются.
public class ClosedPeriod
{
    public int Id { get; set; }
    public YearMonth Month { get; set; }
    public DateOnly ActSignedOn { get; set; }
    public DateTime ClosedAt { get; set; }
}
