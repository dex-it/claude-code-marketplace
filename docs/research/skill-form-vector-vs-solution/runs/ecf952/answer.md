Сделал все три доработки. Сборку и тесты не запускал, как вы просили, поэтому код не проверен.

**Файлы:**
- `VisitJournalService.cs` — изменён: поиск с выбором области, карточка последнего визита и выгрузка CSV.
- `Program.cs` — изменён: параметр `scope` в `/journal/search` и два новых адреса: `GET /pets/{petId}/last-visit` и `GET /vets/{vetId}/visits/export?from=&to=`.
- `ClinicTime.cs` — новый: перевод времени между UTC и местным временем Екатеринбурга.
- `_answer.md` — этот ответ.

**Решения:**
- **Поиск.** Для каждого значения `scope` в коде лежит готовый фрагмент SQL с тем же выражением `to_tsvector`, что и в индексе из README. Текст запроса передаётся только параметром. Визит, где совпало несколько препаратов, попадает в выдачу один раз. Сортировку дополнил по `Id`: в одном слоте бывает несколько визитов, и без этого страницы могли бы перемешиваться. Неизвестный `scope` даёт ответ 400, без параметра поиск идёт по жалобе, как раньше.
- **Карточка визита.** Тут я сам выбрал правило: последний визит — тот, что не отменён и не в будущем; при одинаковом слоте берётся визит с большим `Id`. Визит, врач, анализы и назначения читаются одним запросом: у одного визита строк мало, и данные приходят согласованными. Время на карточке — местное.
- **CSV.** Тоже моё допущение: выгружаются только завершённые приёмы, отменённые и запланированные не попадают. Если бухгалтерии нужны и другие статусы, это одна строка в условии. Даты пересчитываются в UTC от полуночи `from` до полуночи после `to`, запрос попадает в индекс по врачу и времени. Число назначений считает база. 100 тыс. строк не грузятся в память целиком: читаются потоком и сразу пишутся в ответ. Разделитель `;` и UTF-8 с BOM, чтобы файл открывался в русском Excel. Значения, начинающиеся с `=`, `+`, `-`, `@`, получают префикс `'`, чтобы Excel не принял их за формулы.

### ClinicTime.cs
```csharp
namespace VetClinic.Journal.Services;

// Время клиники: в БД - UTC, на экраны и в выгрузки - Asia/Yekaterinburg
public static class ClinicTime
{
    public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Yekaterinburg");

    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    // Местная полночь дня -> момент UTC (Kind=Utc, годится для параметра timestamptz)
    public static DateTime StartOfDayUtc(DateOnly day) =>
        TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), Zone);
}
```

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

public record LabResultItem(string TestCode, decimal Value, string Unit, DateTime TakenAtLocal);

public record PrescriptionItem(string Drug, string Dosage, int Days);

public record LastVisitCard(
    int VisitId,
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

    // Значение scope из query string -> область поиска; без параметра ищем по жалобе, как раньше
    public static bool TryParseScope(string? value, out SearchScope scope)
    {
        switch (value?.ToLowerInvariant())
        {
            case null or "" or "complaint": scope = SearchScope.Complaint; return true;
            case "diagnosis": scope = SearchScope.Diagnosis; return true;
            case "drug": scope = SearchScope.Drug; return true;
            default: scope = default; return false;
        }
    }

    // Белый список SQL: выражения to_tsvector совпадают с выражениями индексов из README,
    // пользовательский текст уходит только параметром {0}
    private static string SearchSql(SearchScope scope) => scope switch
    {
        // ix_visits_complaint_fts
        SearchScope.Complaint =>
            """
            SELECT * FROM "Visits"
            WHERE to_tsvector('russian', "Complaint") @@ plainto_tsquery('russian', {0})
            """,
        // ix_visits_diagnosis_fts
        SearchScope.Diagnosis =>
            """
            SELECT * FROM "Visits"
            WHERE to_tsvector('russian', coalesce("Diagnosis", '')) @@ plainto_tsquery('russian', {0})
            """,
        // ix_prescriptions_drug_fts; EXISTS - визит один раз, даже если совпало несколько назначений
        SearchScope.Drug =>
            """
            SELECT v.* FROM "Visits" AS v
            WHERE EXISTS (
                SELECT 1 FROM "Prescriptions" AS p
                WHERE p."VisitId" = v."Id"
                  AND to_tsvector('russian', p."Drug") @@ plainto_tsquery('russian', {0}))
            """,
        _ => throw new ArgumentOutOfRangeException(nameof(scope), scope, null)
    };

    // Полнотекстовый поиск по жалобе, диагнозу или назначенным препаратам
    public async Task<IReadOnlyList<VisitRow>> SearchAsync(string text, int page, SearchScope scope = SearchScope.Complaint)
    {
        return await db.Visits
            .FromSqlRaw(SearchSql(scope), text)
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id) // слот не уникален - без этого страницы «плывут»
            .Skip(page * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync();
    }

    // Последний состоявшийся (не отменённый и не будущий) визит питомца с анализами и назначениями.
    // В один слот питомец может быть у нескольких врачей - при равном слоте берём визит с большим Id.
    public async Task<LastVisitCard?> GetLastVisitCardAsync(int petId, CancellationToken ct = default)
    {
        var nowUtc = DateTime.UtcNow;

        var visit = await db.Visits
            .Where(v => v.PetId == petId && v.Status != VisitStatus.Cancelled && v.SlotStart <= nowUtc)
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id)
            .Select(v => new
            {
                v.Id,
                v.SlotStart,
                v.Status,
                v.Complaint,
                v.Diagnosis,
                v.VetId,
                VetName = v.Vet.FullName,
                LabResults = v.LabResults
                    .OrderBy(r => r.TakenAt).ThenBy(r => r.Id)
                    .Select(r => new { r.TestCode, r.Value, r.Unit, r.TakenAt })
                    .ToList(),
                Prescriptions = v.Prescriptions
                    .OrderBy(p => p.Id)
                    .Select(p => new PrescriptionItem(p.Drug, p.Dosage, p.Days))
                    .ToList()
            })
            // Один визит: декартово произведение анализов и назначений мало, а одним запросом
            // заголовок и обе коллекции читаются согласованно и за один round-trip
            .AsSingleQuery()
            .FirstOrDefaultAsync(ct);

        if (visit is null)
            return null;

        return new LastVisitCard(
            visit.Id,
            ClinicTime.ToLocal(visit.SlotStart),
            visit.Status,
            visit.Complaint,
            visit.Diagnosis,
            visit.VetId,
            visit.VetName,
            visit.LabResults.Select(r => new LabResultItem(r.TestCode, r.Value, r.Unit, ClinicTime.ToLocal(r.TakenAt))).ToList(),
            visit.Prescriptions);
    }

    private static readonly char[] CsvSpecialChars = [';', '"', '\r', '\n'];

    // Выгрузка завершённых приёмов врача за период [from; to] по местным датам клиники.
    // До ~100 тыс. строк: читаем потоком (без буферизации и трекинга) и сразу пишем в output.
    public async Task ExportVetVisitsCsvAsync(int vetId, DateOnly from, DateOnly to, Stream output, CancellationToken ct = default)
    {
        var fromUtc = ClinicTime.StartOfDayUtc(from);
        var toUtcExclusive = ClinicTime.StartOfDayUtc(to.AddDays(1));

        // Попадает в индекс (VetId, SlotStart)
        var rows = db.Visits
            .Where(v => v.VetId == vetId
                        && v.Status == VisitStatus.Completed
                        && v.SlotStart >= fromUtc
                        && v.SlotStart < toUtcExclusive)
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

        // UTF-8 с BOM и разделитель ';' - чтобы русский Excel открыл файл без мастера импорта
        await using var writer = new StreamWriter(output, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), bufferSize: 64 * 1024, leaveOpen: true);

        await writer.WriteAsync("Дата и время приёма;Кличка;Жалоба;Диагноз;Число назначений\r\n");

        await foreach (var r in rows.WithCancellation(ct))
        {
            var line = string.Join(';',
                ClinicTime.ToLocal(r.SlotStart).ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
                Csv(r.PetName),
                Csv(r.Complaint),
                Csv(r.Diagnosis),
                r.PrescriptionCount.ToString(CultureInfo.InvariantCulture));

            await writer.WriteAsync(line);
            await writer.WriteAsync("\r\n");
        }

        await writer.FlushAsync(ct);
    }

    // Экранирование поля CSV (RFC 4180) + защита от формул при открытии в Excel
    private static string Csv(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            value = "'" + value;

        if (value.IndexOfAny(CsvSpecialChars) >= 0)
            value = "\"" + value.Replace("\"", "\"\"") + "\"";

        return value;
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

// scope: complaint | diagnosis | drug (по умолчанию complaint)
app.MapGet("/journal/search", async (string q, int page, string? scope, VisitJournalService s) =>
    VisitJournalService.TryParseScope(scope, out var searchScope)
        ? Results.Ok(await s.SearchAsync(q, page, searchScope))
        : Results.BadRequest("scope: complaint | diagnosis | drug"));

app.MapGet("/pets/{petId:int}/last-visit", async (int petId, VisitJournalService s, CancellationToken ct) =>
    await s.GetLastVisitCardAsync(petId, ct) is { } card
        ? Results.Ok(card)
        : Results.NotFound());

// from/to - местные даты клиники (yyyy-MM-dd), обе включительно
app.MapGet("/vets/{vetId:int}/visits/export", (int vetId, DateOnly from, DateOnly to, VisitJournalService s, CancellationToken ct) =>
    from > to
        ? Results.BadRequest("from > to")
        : Results.Stream(
            stream => s.ExportVetVisitsCsvAsync(vetId, from, to, stream, ct),
            contentType: "text/csv; charset=utf-8",
            fileDownloadName: $"visits_vet{vetId}_{from:yyyyMMdd}_{to:yyyyMMdd}.csv"));

app.Run();
```