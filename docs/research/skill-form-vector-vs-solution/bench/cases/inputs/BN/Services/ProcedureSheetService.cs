using Microsoft.EntityFrameworkCore;
using Npgsql;
using VetClinic.Procedures.Data;
using VetClinic.Procedures.Domain;

namespace VetClinic.Procedures.Services;

public record DaySheetRow(int Id, DateTime ScheduledLocal, string PetName, string Title, ProcedureStatus Status);

public class ConsumptionRow
{
    public string Item { get; set; } = "";
    public string Unit { get; set; } = "";
    public decimal Total { get; set; }
}

public class ProcedureSheetService(ClinicDbContext db)
{
    private const int PageSize = 30;

    private static readonly Dictionary<string, string> ConsumptionSort = new(StringComparer.OrdinalIgnoreCase)
    {
        ["item"] = "\"Item\", \"Unit\"",
        ["total"] = "\"Total\" DESC, \"Item\"",
    };

    // Лист дня процедурного кабинета
    public async Task<List<DaySheetRow>> GetDaySheetAsync(DateOnly date, int page)
    {
        var from = date.ToDateTime(TimeOnly.MinValue);
        var to = from.AddDays(1);

        return await db.Procedures
            .Where(p => p.ScheduledLocal >= from && p.ScheduledLocal < to && p.Status != ProcedureStatus.Cancelled)
            .OrderBy(p => p.ScheduledLocal)
            .ThenBy(p => p.Id)
            .Skip(page * PageSize)
            .Take(PageSize)
            .Select(p => new DaySheetRow(p.Id, p.ScheduledLocal, p.Pet.Name, p.Title, p.Status))
            .ToListAsync();
    }

    public async Task<List<DaySheetRow>> FindByTitleAsync(string query)
    {
        var q = query.Trim().ToLower();
        return await db.Procedures
            .Where(p => p.Title.ToLower().Contains(q))
            .OrderByDescending(p => p.ScheduledLocal)
            .ThenByDescending(p => p.Id)
            .Take(100)
            .Select(p => new DaySheetRow(p.Id, p.ScheduledLocal, p.Pet.Name, p.Title, p.Status))
            .ToListAsync();
    }

    // Полнотекстовый поиск по заметкам процедуры
    public async Task<List<DaySheetRow>> SearchNotesAsync(string text) =>
        await db.Procedures
            .FromSql($"""
                SELECT * FROM "Procedures"
                WHERE to_tsvector('russian', coalesce("Notes", '')) @@ plainto_tsquery('russian', {text})
                """)
            .OrderByDescending(p => p.ScheduledLocal)
            .ThenByDescending(p => p.Id)
            .Take(100)
            .Select(p => new DaySheetRow(p.Id, p.ScheduledLocal, p.Pet.Name, p.Title, p.Status))
            .ToListAsync();

    // Расход материалов по закрытым процедурам за месяц
    public async Task<List<ConsumptionRow>> GetConsumptionAsync(DateOnly month, string sort)
    {
        if (!ConsumptionSort.TryGetValue(sort, out var orderBy))
            throw new ArgumentException($"Неизвестная сортировка: {sort}", nameof(sort));

        var from = new DateTime(month.Year, month.Month, 1);
        var to = from.AddMonths(1);

        var sql = $"""
            SELECT c."Item" AS "Item", c."Unit" AS "Unit", sum(c."Quantity") AS "Total"
            FROM "ConsumableLines" c
            JOIN "Procedures" p ON p."Id" = c."ProcedureId"
            WHERE p."ScheduledLocal" >= @from AND p."ScheduledLocal" < @to AND p."Status" = @closed
            GROUP BY c."Item", c."Unit"
            ORDER BY {orderBy}
            """;

        return await db.Database
            .SqlQueryRaw<ConsumptionRow>(sql,
                new NpgsqlParameter("from", from),
                new NpgsqlParameter("to", to),
                new NpgsqlParameter("closed", (int)ProcedureStatus.Closed))
            .ToListAsync();
    }
}
