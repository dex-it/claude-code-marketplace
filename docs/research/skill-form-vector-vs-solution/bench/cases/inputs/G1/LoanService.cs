using Microsoft.EntityFrameworkCore;

namespace BookQuarter.Library;

public class LoanService
{
    private const int LoanDays = 21;

    private readonly LibraryDbContext _db;
    private readonly FineRules _rules = FineRules.Default;

    public LoanService(LibraryDbContext db) => _db = db;

    public async Task<int> IssueAsync(string cardNumber, int bookId, int branchId)
    {
        var reader = await _db.Readers.SingleOrDefaultAsync(r => r.CardNumber == cardNumber)
            ?? throw new InvalidOperationException("Читательский билет не найден");
        var branch = await _db.Branches.FindAsync(branchId)
            ?? throw new InvalidOperationException("Филиал не найден");

        var loan = new Loan
        {
            ReaderId = reader.Id,
            BookId = bookId,
            BranchId = branch.Id,
            IssuedAt = DateTimeOffset.UtcNow,
            DueDate = LocalToday(branch).AddDays(LoanDays),
        };
        _db.Loans.Add(loan);
        await _db.SaveChangesAsync();
        return loan.Id;
    }

    public async Task ReturnAsync(int loanId)
    {
        var loan = await _db.Loans
            .Include(l => l.Reader)
            .Include(l => l.Branch)
            .FirstOrDefaultAsync(l => l.Id == loanId)
            ?? throw new InvalidOperationException("Выдача не найдена");

        if (loan.ReturnedAt != null)
            return;

        loan.Reader.FineBalance += Fines.Amount(loan.DueDate, LocalToday(loan.Branch), loan.Reader.Category, _rules);
        loan.ReturnedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
    }

    // Список выдач читателя на кафедре.
    public async Task<List<LoanRow>> GetActiveLoansAsync(string cardNumber, int branchId)
    {
        var branch = await _db.Branches.FindAsync(branchId)
            ?? throw new InvalidOperationException("Филиал не найден");

        return await _db.Loans
            .Where(l => l.Reader.CardNumber == cardNumber && l.ReturnedAt == null)
            .OrderBy(l => l.DueDate)
            .ToLoanRows(LocalToday(branch), _rules)
            .ToListAsync();
    }

    // Счётчик на табло филиала: сколько книг выдано сегодня.
    public async Task<int> CountIssuedTodayAsync(int branchId)
    {
        var branch = await _db.Branches.FindAsync(branchId)
            ?? throw new InvalidOperationException("Филиал не найден");

        var tz = TimeZoneInfo.FindSystemTimeZoneById(branch.TimeZoneId);
        var dayStart = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(LocalToday(branch).ToDateTime(TimeOnly.MinValue), tz));
        var dayEnd = dayStart.AddDays(1);

        return await _db.Loans.CountAsync(l =>
            l.BranchId == branchId && l.IssuedAt >= dayStart && l.IssuedAt < dayEnd);
    }

    private static DateOnly LocalToday(Branch branch)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(branch.TimeZoneId);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).DateTime);
    }
}
