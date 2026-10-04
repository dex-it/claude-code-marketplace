Все три доработки внесены в `VisitJournalService.cs`, эндпоинты добавлены в `Program.cs`. Сборку и тесты я не запускал.

**Изменённые файлы:**
- `VisitJournalService.cs`: поиск со `scope`, `GetLastVisitCardAsync`, `ExportVetVisitsCsvAsync`, новые DTO и `SearchScope`.
- `Program.cs`: `GET /journal/search?q=&page=&scope=`, `GET /pets/{petId}/last-visit`, `GET /vets/{vetId}/visits/export.csv?from=yyyy-MM-dd&to=yyyy-MM-dd`.
- `_answer.md`: этот ответ.

**Решения:**
- **Поиск.** Для каждого `scope` свой фиксированный SQL, выражения совпадают с индексами из README, включая `coalesce("Diagnosis", '')`. Для препаратов — `EXISTS` по назначениям, чтобы визиты не дублировались. Без `scope` ищем по жалобе, как раньше; неизвестное значение даёт 400. В сортировку добавлен `Id`: в одном слоте бывает несколько визитов, и без него страницы могли пересекаться.
- **Только завершённые визиты.** Карточка и выгрузка берут визиты в статусе `Completed`. Если нужны ещё «в процессе», это одно условие — скажите, если так. Карточка грузится в два шага: сначала Id последнего визита, потом визит с анализами и назначениями по этому Id. Иначе раздельные запросы могли бы подхватить данные другого визита.
- **Выгрузка.** Строки пишутся прямо в ответ по мере чтения из БД, в памяти держится одна строка. Даты `from`–`to` переводятся из времени Екатеринбурга в UTC, запрос попадает в индекс `(VetId, SlotStart)`. Формат: UTF-8 с BOM, разделитель `;`, кавычки по RFC 4180, защита от формул Excel.

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

public record LabResultItem(int Id, string TestCode, decimal Value, string Unit, DateTimeOffset TakenAt);

public record PrescriptionItem(int Id, string Drug, string Dosage, int Days);

// Времена - по местному времени клиники (DateTimeOffset со смещением Asia/Yekaterinburg)
public record LastVisitCard(
    int VisitId,
    DateTimeOffset SlotStart,
    VisitStatus Status,
    string Complaint,
    string? Diagnosis,
    int PetId,
    string PetName,
    string Species,
    int VetId,
    string VetName,
    IReadOnlyList<LabResultItem> LabResults,
    IReadOnlyList<PrescriptionItem> Prescriptions);

public class VisitJournalService(ClinicDbContext db)
{
    private const int PageSize = 50;

    private static readonly TimeZoneInfo ClinicTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Yekaterinburg");

    // Выражения to_tsvector(...) должны совпадать с выражениями индексов из README буква в букву,
    // иначе планировщик не возьмёт GIN-индекс. SQL фиксированный, текст запроса - только параметром {0}.
    private const string ComplaintSql =
        """
        SELECT * FROM "Visits"
        WHERE to_tsvector('russian', "Complaint") @@ plainto_tsquery('russian', {0})
        """;

    // ix_visits_diagnosis_fts
    private const string DiagnosisSql =
        """
        SELECT * FROM "Visits"
        WHERE to_tsvector('russian', coalesce("Diagnosis", '')) @@ plainto_tsquery('russian', {0})
        """;

    // ix_prescriptions_drug_fts; EXISTS - чтобы визит с несколькими подходящими назначениями не дублировался
    private const string DrugSql =
        """
        SELECT v.* FROM "Visits" AS v
        WHERE EXISTS (
            SELECT 1 FROM "Prescriptions" AS p
            WHERE p."VisitId" = v."Id"
              AND to_tsvector('russian', p."Drug") @@ plainto_tsquery('russian', {0}))
        """;

    // Значение scope из query string; пусто - поиск по жалобе, как раньше
    public static bool TryParseScope(string? value, out SearchScope scope)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case null or "" or "complaint":
                scope = SearchScope.Complaint;
                return true;
            case "diagnosis":
                scope = SearchScope.Diagnosis;
                return true;
            case "drug":
                scope = SearchScope.Drug;
                return true;
            default:
                scope = default;
                return false;
        }
    }

    // Полнотекстовый поиск по жалобе, диагнозу или назначенным препаратам
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
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id) // в одном слоте бывает несколько визитов - нужен однозначный порядок для страниц
            .Skip(page * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync();
    }

    // Карточка последнего состоявшегося (Completed) визита питомца; null - если таких нет
    public async Task<LastVisitCard?> GetLastVisitCardAsync(int petId, CancellationToken ct = default)
    {
        // Сначала только Id: питомец может быть в одном слоте у нескольких врачей, поэтому добиваем порядок по Id.
        // Коллекции грузятся split-запросами (см. Program.cs) - грузим их уже по конкретному Id,
        // чтобы все запросы гарантированно относились к одному и тому же визиту.
        var visitId = await db.Visits
            .Where(v => v.PetId == petId && v.Status == VisitStatus.Completed)
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id)
            .Select(v => (int?)v.Id)
            .FirstOrDefaultAsync(ct);

        if (visitId is null)
            return null;

        var visit = await db.Visits
            .AsNoTracking()
            .Include(v => v.Pet)
            .Include(v => v.Vet)
            .Include(v => v.LabResults)
            .Include(v => v.Prescriptions)
            .SingleOrDefaultAsync(v => v.Id == visitId.Value, ct);

        if (visit is null)
            return null;

        return new LastVisitCard(
            visit.Id,
            ToClinicTime(visit.SlotStart),
            visit.Status,
            visit.Complaint,
            visit.Diagnosis,
            visit.Pet.Id,
            visit.Pet.Name,
            visit.Pet.Species,
            visit.Vet.Id,
            visit.Vet.FullName,
            visit.LabResults
                .OrderBy(r => r.TakenAt).ThenBy(r => r.Id)
                .Select(r => new LabResultItem(r.Id, r.TestCode, r.Value, r.Unit, ToClinicTime(r.TakenAt)))
                .ToList(),
            visit.Prescriptions
                .OrderBy(p => p.Id)
                .Select(p => new PrescriptionItem(p.Id, p.Drug, p.Dosage, p.Days))
                .ToList());
    }

    // Выгрузка состоявшихся (Completed) приёмов врача за период [from; to] по местным датам клиники.
    // Пишется потоково: строки читаются из БД и сразу уходят в stream, в памяти весь период не держим.
    public async Task ExportVetVisitsCsvAsync(int vetId, DateOnly from, DateOnly to, Stream output, CancellationToken ct = default)
    {
        // Полуинтервал [начало дня from; начало дня после to) в UTC - по индексу (VetId, SlotStart)
        var fromUtc = LocalDateStartToUtc(from);
        var toUtcExclusive = LocalDateStartToUtc(to.AddDays(1));

        var rows = db.Visits
            .AsNoTracking()
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

        // UTF-8 с BOM и ';' - чтобы русский Excel открыл файл без мастера импорта.
        // await using: Dispose должен сбросить буфер асинхронно (Kestrel запрещает синхронный IO).
        await using var writer = new StreamWriter(output, new UTF8Encoding(false), bufferSize: 64 * 1024, leaveOpen: true);
        await writer.WriteAsync('\uFEFF');
        await writer.WriteAsync("Дата и время приёма;Кличка питомца;Жалоба;Диагноз;Число назначений\r\n");

        var line = new StringBuilder();
        await foreach (var r in rows.WithCancellation(ct))
        {
            line.Clear()
                .Append(ToClinicTime(r.SlotStart).ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture)).Append(';')
                .Append(CsvField(r.PetName)).Append(';')
                .Append(CsvField(r.Complaint)).Append(';')
                .Append(CsvField(r.Diagnosis)).Append(';')
                .Append(r.PrescriptionCount.ToString(CultureInfo.InvariantCulture))
                .Append("\r\n");
            await writer.WriteAsync(line, ct);
        }

        await writer.FlushAsync(ct);
    }

    private static DateTimeOffset ToClinicTime(DateTime utc) =>
        TimeZoneInfo.ConvertTime(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)), ClinicTimeZone);

    // Npgsql для timestamptz принимает только DateTime с Kind = Utc
    private static DateTime LocalDateStartToUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), ClinicTimeZone);

    private static string CsvField(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        // Свободный текст из журнала: не даём Excel трактовать его как формулу
        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            value = "'" + value;

        if (value.AsSpan().IndexOfAny(";\"\r\n") >= 0)
            return "\"" + value.Replace("\"", "\"\"") + "\"";

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

// scope: complaint (по умолчанию) | diagnosis | drug
app.MapGet("/journal/search", async (string q, int page, string? scope, VisitJournalService s) =>
    VisitJournalService.TryParseScope(scope, out var parsed)
        ? Results.Ok(await s.SearchAsync(q, page, parsed))
        : Results.BadRequest("scope: complaint | diagnosis | drug"));

app.MapGet("/pets/{petId:int}/last-visit", async (int petId, VisitJournalService s, CancellationToken ct) =>
    await s.GetLastVisitCardAsync(petId, ct) is { } card
        ? Results.Ok(card)
        : Results.NotFound());

// from/to - местные даты клиники в формате yyyy-MM-dd, обе включительно
app.MapGet("/vets/{vetId:int}/visits/export.csv",
    async (int vetId, DateOnly from, DateOnly to, HttpContext http, VisitJournalService s, CancellationToken ct) =>
    {
        if (from > to)
            return Results.BadRequest("from > to");

        http.Response.ContentType = "text/csv; charset=utf-8";
        http.Response.Headers.ContentDisposition =
            $"attachment; filename=\"vet-{vetId}-visits-{from:yyyyMMdd}-{to:yyyyMMdd}.csv\"";

        await s.ExportVetVisitsCsvAsync(vetId, from, to, http.Response.Body, ct);
        return Results.Empty;
    });

app.Run();
```

Список файлов и решения записаны в `_answer.md`.