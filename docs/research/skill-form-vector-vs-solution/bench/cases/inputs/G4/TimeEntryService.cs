using Microsoft.EntityFrameworkCore;

namespace Pixelwork.Timesheets;

public record TimeEntryDto(int Id, int ProjectId, int EmployeeId, DateOnly WorkDate, decimal Hours, string Comment);

public class TimeEntryService
{
    private readonly AgencyDbContext _db;

    public TimeEntryService(AgencyDbContext db) => _db = db;

    public async Task<int> AddAsync(TimeEntryDto dto)
    {
        ValidateHours(dto.Hours);
        await EnsureOpenAsync(dto.WorkDate);

        var entry = new TimeEntry
        {
            ProjectId = dto.ProjectId,
            EmployeeId = dto.EmployeeId,
            WorkDate = dto.WorkDate,
            Hours = dto.Hours,
            Comment = dto.Comment,
        };
        _db.TimeEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry.Id;
    }

    public async Task UpdateAsync(TimeEntryDto dto)
    {
        ValidateHours(dto.Hours);

        var entry = await _db.TimeEntries.FirstOrDefaultAsync(t => t.Id == dto.Id)
            ?? throw new KeyNotFoundException();

        await EnsureOpenAsync(entry.WorkDate);
        await EnsureOpenAsync(dto.WorkDate);

        entry.ProjectId = dto.ProjectId;
        entry.WorkDate = dto.WorkDate;
        entry.Hours = dto.Hours;
        entry.Comment = dto.Comment;
        await _db.SaveChangesAsync();
    }

    public async Task<decimal> HoursForMonthAsync(int employeeId, int year, int month)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1);
        return await _db.TimeEntries
            .Where(t => t.EmployeeId == employeeId && t.WorkDate >= from && t.WorkDate < to)
            .SumAsync(t => t.Hours);
    }

    private async Task EnsureOpenAsync(DateOnly workDate)
    {
        var month = YearMonth.Of(workDate);
        if (await _db.ClosedPeriods.AnyAsync(p => p.Month == month))
            throw new ClosedPeriodException(month);
    }

    private static void ValidateHours(decimal hours)
    {
        if (hours is <= 0 or > 24)
            throw new ArgumentOutOfRangeException(nameof(hours));
    }
}

public class ClosedPeriodException(YearMonth month)
    : InvalidOperationException($"Месяц {month} закрыт актом");
