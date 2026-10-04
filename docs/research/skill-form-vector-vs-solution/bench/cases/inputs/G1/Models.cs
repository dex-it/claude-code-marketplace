namespace BookQuarter.Library;

public enum ReaderCategory { Adult, Child, Pensioner }

public class Branch
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    // Филиалы сети в Екатеринбурге, Перми и Тюмени; IANA-идентификатор пояса.
    public string TimeZoneId { get; set; } = "Asia/Yekaterinburg";
}

public class Reader
{
    public int Id { get; set; }
    public string CardNumber { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public ReaderCategory Category { get; set; }
    public int HomeBranchId { get; set; }
    public Branch HomeBranch { get; set; } = null!;
    public decimal FineBalance { get; set; }

    public List<Loan> Loans { get; set; } = new();
}

public class Book
{
    public int Id { get; set; }
    public string Isbn { get; set; } = "";
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
}

public class Loan
{
    public int Id { get; set; }
    public int ReaderId { get; set; }
    public Reader Reader { get; set; } = null!;
    public int BookId { get; set; }
    public Book Book { get; set; } = null!;
    public int BranchId { get; set; }
    public Branch Branch { get; set; } = null!;

    public DateTimeOffset IssuedAt { get; set; }
    public DateOnly DueDate { get; set; }
    public DateTimeOffset? ReturnedAt { get; set; }
}
