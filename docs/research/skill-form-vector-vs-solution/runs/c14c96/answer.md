Готово. Сборку и тесты не запускал, как и требовалось.

**Изменённые файлы** (полностью приведены ниже):
- `VisitJournalService.cs`
- `Program.cs`
- `_answer.md` — новый, в нём тот же ответ.

**Решения:**
- **(а) Поиск.** Параметр `scope` принимается только из списка `complaint | diagnosis | drug`. Для каждого значения есть заранее написанный SQL-запрос, а текст поиска передаётся только параметром. Выражения `to_tsvector` дословно повторяют индексы из README, иначе PostgreSQL их не возьмёт. Поиск по препарату сделан через `EXISTS`, чтобы один визит не выводился дважды. Без `scope` ищем по жалобе, как раньше; на неизвестное значение отвечаем 400. В сортировку добавил `Id`, иначе визиты из одного слота могли бы перескакивать между страницами.
- **(б) Карточка последнего визита.** Сначала однозначно выбирается id визита: по `SlotStart DESC, Id DESC`, без отменённых и будущих записей. Потом визит грузится по ключу вместе с анализами и назначениями. Иначе из-за раздельных запросов (`SplitQuery`) и совместных приёмов в одном слоте анализы и назначения могли бы подтянуться от другого визита.
- **(в) Выгрузка CSV.** Местные даты переводятся в UTC-интервал от `from 00:00` включительно до `to+1 00:00` не включительно, поэтому запрос использует индекс `(VetId, SlotStart)`. Строки читаются и пишутся в ответ потоком, без загрузки 100 тыс. записей в память; запись только асинхронная, потому что синхронную Kestrel запрещает. Разделитель `;` и BOM нужны, чтобы файл сразу открылся в русском Excel. Поля экранируются, есть защита от подстановки формул.

**Что решил сам, проверьте:**
- Отменённые приёмы не попадают в выгрузку для бухгалтерии — если их нужно включать, это одно условие в запросе.
- В карточке «последний визит» — это не отменённый визит, который уже начался по времени; запланированные на будущее не учитываются.

### VisitJournalService.cs
```csharp
using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using VetClinic.Journal.Data;
using VetClinic.Journal.Domain;

namespace VetClinic.Journal.Services;

public record VisitRow(int Id, DateTime SlotStartUtc, string PetName, string VetName, string Complaint, string? Diagnosis);

public enum SearchScope
{
    Complaint,
    Diagnosis,
    Drug
}

public record LabResultItem(int Id, string TestCode, decimal Value, string Unit, DateTime TakenAtLocal);

public record PrescriptionItem(int Id, string Drug, string Dosage, int Days);

public record LastVisitCard(
    int VisitId,
    int PetId,
    string PetName,
    string Species,
    DateTime SlotStartLocal,
    VisitStatus Status,
    string Complaint,
    string? Diagnosis,
    int VetId,
    string VetName,
    IReadOnlyList<LabResultItem> LabResults,
    IReadOnlyList<PrescriptionItem> Prescriptions);

public class VisitJournalService(ClinicDbContext db)
{
    private const int PageSize = 50;

    // Часовой пояс клиники (README): все "местные" даты/время - отсюда
    private static readonly TimeZoneInfo ClinicTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Yekaterinburg");

    // Тексты SQL - только константы. Выражения to_tsvector(...) должны дословно совпадать
    // с выражениями индексов из README, иначе планировщик не возьмёт GIN-индекс.
    private const string ComplaintSql =
        """
        SELECT * FROM "Visits"
        WHERE to_tsvector('russian', "Complaint") @@ plainto_tsquery('russian', {0})
        """;

    private const string DiagnosisSql =
        """
        SELECT * FROM "Visits"
        WHERE to_tsvector('russian', coalesce("Diagnosis", '')) @@ plainto_tsquery('russian', {0})
        """;

    // EXISTS, а не JOIN: визит с несколькими подходящими препаратами не должен дублироваться в выдаче
    private const string DrugSql =
        """
        SELECT * FROM "Visits" AS v
        WHERE EXISTS (
            SELECT 1 FROM "Prescriptions" AS p
            WHERE p."VisitId" = v."Id"
              AND to_tsvector('russian', p."Drug") @@ plainto_tsquery('russian', {0}))
        """;

    public static bool TryParseScope(string? value, out SearchScope scope)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case null or "" or "complaint": scope = SearchScope.Complaint; return true;
            case "diagnosis": scope = SearchScope.Diagnosis; return true;
            case "drug": scope = SearchScope.Drug; return true;
            default: scope = default; return false;
        }
    }

    // Полнотекстовый поиск по жалобе / диагнозу / препаратам
    // (индексы ix_visits_complaint_fts / ix_visits_diagnosis_fts / ix_prescriptions_drug_fts)
    public async Task<IReadOnlyList<VisitRow>> SearchAsync(string text, int page, SearchScope scope = SearchScope.Complaint)
    {
        var sql = scope switch
        {
            SearchScope.Complaint => ComplaintSql,
            SearchScope.Diagnosis => DiagnosisSql,
            SearchScope.Drug => DrugSql,
            _ => throw new ArgumentOutOfRangeException(nameof(scope))
        };

        return await db.Visits
            .FromSqlRaw(sql, text)
            .AsNoTracking()
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id) // в одном слоте бывает несколько визитов - без этого страницы "плывут"
            .Skip(Math.Max(page, 0) * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync();
    }

    // Карточка последнего визита питомца: отменённые и будущие записи не считаются визитами
    public async Task<LastVisitCard?> GetLastVisitCardAsync(int petId)
    {
        var now = DateTime.UtcNow;

        // Сначала однозначно определяем визит (в одном слоте может быть несколько врачей -
        // нужен тай-брейк по Id), потом грузим его по ключу. Иначе при глобальном SplitQuery
        // запросы за анализами/назначениями могли бы выбрать другой "первый" визит.
        var visitId = await db.Visits
            .Where(v => v.PetId == petId && v.Status != VisitStatus.Cancelled && v.SlotStart <= now)
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id)
            .Select(v => (int?)v.Id)
            .FirstOrDefaultAsync();

        if (visitId is null)
            return null;

        var visit = await db.Visits
            .AsNoTracking()
            .Include(v => v.Pet)
            .Include(v => v.Vet)
            .Include(v => v.LabResults.OrderBy(r => r.TakenAt).ThenBy(r => r.Id))
            .Include(v => v.Prescriptions.OrderBy(p => p.Id))
            .SingleOrDefaultAsync(v => v.Id == visitId.Value);

        if (visit is null) // удалили между запросами
            return null;

        return new LastVisitCard(
            visit.Id,
            visit.PetId,
            visit.Pet.Name,
            visit.Pet.Species,
            ToLocal(visit.SlotStart),
            visit.Status,
            visit.Complaint,
            visit.Diagnosis,
            visit.VetId,
            visit.Vet.FullName,
            visit.LabResults.Select(r => new LabResultItem(r.Id, r.TestCode, r.Value, r.Unit, ToLocal(r.TakenAt))).ToList(),
            visit.Prescriptions.Select(p => new PrescriptionItem(p.Id, p.Drug, p.Dosage, p.Days)).ToList());
    }

    // Выгрузка приёмов врача за период [from; to] по местным датам клиники, потоково в output.
    // Отменённые приёмы не выгружаются.
    public async Task ExportVetVisitsCsvAsync(int vetId, DateOnly from, DateOnly to, Stream output, CancellationToken ct = default)
    {
        if (to < from)
            throw new ArgumentException("Дата окончания периода раньше даты начала.", nameof(to));

        // Полуинтервал [начало дня from; начало дня to+1) в UTC - попадает в индекс (VetId, SlotStart)
        var fromUtc = LocalDayStartToUtc(from);
        var toUtcExclusive = LocalDayStartToUtc(to.AddDays(1));

        var rows = db.Visits
            .AsNoTracking()
            .Where(v => v.VetId == vetId
                        && v.SlotStart >= fromUtc
                        && v.SlotStart < toUtcExclusive
                        && v.Status != VisitStatus.Cancelled)
            .OrderBy(v => v.SlotStart)
            .ThenBy(v => v.Id)
            .Select(v => new
            {
                v.SlotStart,
                PetName = v.Pet.Name,
                v.Complaint,
                v.Diagnosis,
                PrescriptionCount = v.Prescriptions.Count()
            })
            .AsAsyncEnumerable();

        // ';' и BOM - чтобы русский Excel открыл файл без мастера импорта.
        // Только асинхронная запись/закрытие: Kestrel запрещает синхронный IO в тело ответа.
        await using var writer = new StreamWriter(output, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), bufferSize: 64 * 1024, leaveOpen: true);

        await writer.WriteLineAsync("Дата и время приёма;Кличка;Жалоба;Диагноз;Число назначений".AsMemory(), ct);

        await foreach (var r in rows.WithCancellation(ct))
        {
            var line = string.Join(';',
                ToLocal(r.SlotStart).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                Csv(r.PetName),
                Csv(r.Complaint),
                Csv(r.Diagnosis),
                r.PrescriptionCount.ToString(CultureInfo.InvariantCulture));
            await writer.WriteLineAsync(line.AsMemory(), ct);
        }

        await writer.FlushAsync(ct);
    }

    private static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), ClinicTz);

    private static DateTime LocalDayStartToUtc(DateOnly day) =>
        TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), ClinicTz);

    private static string Csv(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        // Защита от CSV-инъекции формул в Excel
        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            value = "'" + value;

        return value.IndexOfAny([';', '"', '\n', '\r']) >= 0
            ? "\"" + value.Replace("\"", "\"\"") + "\""
            : value;
    }
}
```

### Program.cs
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Journal.Data;
using VetClinic.Journal.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ClinicDbContext>(o => o.UseNpgsql(
    builder.Configuration.GetConnectionString("Journal"),
    // у визита несколько коллекций (анализы, назначения) - грузим их отдельными запросами
    npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

builder.Services.AddScoped<VisitJournalService>();

var app = builder.Build();

// scope: complaint (по умолчанию) | diagnosis | drug
app.MapGet("/journal/search", async (string q, int page, string? scope, VisitJournalService s) =>
{
    if (!VisitJournalService.TryParseScope(scope, out var parsed))
        return Results.BadRequest("scope: complaint | diagnosis | drug");

    return Results.Ok(await s.SearchAsync(q, page, parsed));
});

app.MapGet("/pets/{petId:int}/last-visit", async (int petId, VisitJournalService s) =>
    await s.GetLastVisitCardAsync(petId) is { } card ? Results.Ok(card) : Results.NotFound());

// from/to - местные даты клиники (yyyy-MM-dd), обе включительно
app.MapGet("/vets/{vetId:int}/visits/export", (int vetId, DateOnly from, DateOnly to, VisitJournalService s, HttpContext http) =>
{
    if (to < from)
        return Results.BadRequest("to < from");

    return Results.Stream(
        body => s.ExportVetVisitsCsvAsync(vetId, from, to, body, http.RequestAborted),
        contentType: "text/csv; charset=utf-8",
        fileDownloadName: $"visits_vet{vetId}_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.csv");
});

app.Run();
```