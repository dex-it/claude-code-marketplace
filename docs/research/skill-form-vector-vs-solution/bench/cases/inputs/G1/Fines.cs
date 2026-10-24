namespace BookQuarter.Library;

public record FineRules(decimal PerDay, int GraceDays, decimal Max)
{
    public static readonly FineRules Default = new(10m, 3, 500m);
}

// Правила начисления штрафа (Положение о пользовании библиотекой, п. 6.3).
public static class Fines
{
    public static int DaysOverdue(DateOnly dueDate, DateOnly today) =>
        Math.Max(0, today.DayNumber - dueDate.DayNumber);

    public static decimal Amount(DateOnly dueDate, DateOnly today, ReaderCategory category, FineRules rules)
    {
        if (category == ReaderCategory.Child)
            return 0m;

        var days = DaysOverdue(dueDate, today) - rules.GraceDays;
        return days <= 0 ? 0m : Math.Min(days * rules.PerDay, rules.Max);
    }
}

public sealed class LoanRow
{
    public int LoanId { get; init; }
    public string CardNumber { get; init; } = "";
    public string Reader { get; init; } = "";
    public string Phone { get; init; } = "";
    public string Book { get; init; } = "";
    public DateOnly DueDate { get; init; }
    public int DaysOverdue { get; init; }
    public decimal Fine { get; init; }
}

public static class LoanRows
{
    // Строки выдач в том виде, как их видит библиотекарь на кафедре.
    public static IQueryable<LoanRow> ToLoanRows(this IQueryable<Loan> loans, DateOnly today, FineRules rules) =>
        loans.Select(l => new LoanRow
        {
            LoanId = l.Id,
            CardNumber = l.Reader.CardNumber,
            Reader = l.Reader.FullName,
            Phone = l.Reader.Phone,
            Book = l.Book.Title,
            DueDate = l.DueDate,
            DaysOverdue = Fines.DaysOverdue(l.DueDate, today),
            Fine = Fines.Amount(l.DueDate, today, l.Reader.Category, rules),
        });
}
