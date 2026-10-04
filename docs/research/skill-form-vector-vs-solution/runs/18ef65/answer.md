Сделал все три доработки в `VisitJournalService.cs` и добавил эндпоинты в `Program.cs`. Сборку и тесты, как и договаривались, не запускал. Ответ записан в `_answer.md`.

## Изменённые файлы
- `VisitJournalService.cs`: `SearchAsync` с выбором, где искать, `GetLastVisitCardAsync`, `ExportVetVisitsCsvAsync` и новые классы ответа (DTO).
- `Program.cs`: `GET /journal/search?q=&scope=&page=`, `GET /pets/{petId}/last-visit`, `GET /vets/{vetId}/visits.csv?from=&to=`.
- `_answer.md`: этот ответ.

## Решения
- **Поиск.** Значение `scope` проверяется по списку complaint, diagnosis, drug; на другие значения эндпоинт отвечает 400. Без `scope` поиск идёт по жалобе, как раньше. Для каждого варианта в коде свой готовый SQL. Выражения `to_tsvector` в нём точно совпадают с индексами из README (для диагноза с `coalesce`, для препаратов через `EXISTS` по `"Prescriptions"`), поэтому GIN-индексы используются. Текст поиска передаётся только параметром. Сортировку дополнил `Id`: в один слот бывает записано несколько визитов, и без этого строки переезжали между страницами.
- **Карточка визита.** Карточка собирается одним запросом с `AsNoTracking`, анализы и назначения подгружаются отдельными запросами (`SplitQuery`). Время в карточке показывается по местному времени клиники.
- **Выгрузка CSV.** CSV пишется прямо в ответ по одной строке, а число назначений считается в базе через `COUNT`. Поэтому 100 тыс. приёмов не держатся в памяти. Период пересчитывается в UTC как `[from 00:00; to+1 00:00)` по Екатеринбургу, под фильтр подходит индекс `(VetId, SlotStart)`. Файл в UTF-8 с BOM для Excel, разделитель `;`, поля экранируются, есть защита от CSV-инъекций.

## Нужно подтвердить
- И в карточку, и в выгрузку попадают только состоявшиеся приёмы (`Completed`/`InProgress`). Запланированные и отменённые я не учитываю — это моё допущение, его нужно подтвердить.
- Если у питомца в одном слоте несколько визитов (совместный приём), в карточку попадает визит с большим `Id`.

## VisitJournalService.cs
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
    DateTime SlotStartLocal,
    VisitStatus Status,
    string Complaint,
    string? Diagnosis,
    int PetId,
    string PetName,
    string PetSpecies,
    int VetId,
    string VetName,
    IReadOnlyList<LabResultItem> LabResults,
    IReadOnlyList<PrescriptionItem> Prescriptions);

public class VisitJournalService(ClinicDbContext db)
{
    private const int PageSize = 50;

    // Часовой пояс клиники (см. README); в БД моменты хранятся в UTC
    public static readonly TimeZoneInfo ClinicTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Yekaterinburg");

    // Выражения to_tsvector должны текстуально совпадать с выражениями индексов из README,
    // иначе планировщик не использует GIN-индекс. Пользовательский ввод идёт только параметром {0}.
    private const string ComplaintSearchSql =
        """
        SELECT * FROM "Visits"
        WHERE to_tsvector('russian', "Complaint") @@ plainto_tsquery('russian', {0})
        """;

    private const string DiagnosisSearchSql =
        """
        SELECT * FROM "Visits"
        WHERE to_tsvector('russian', coalesce("Diagnosis", '')) @@ plainto_tsquery('russian', {0})
        """;

    private const string DrugSearchSql =
        """
        SELECT * FROM "Visits" v
        WHERE EXISTS (
            SELECT 1 FROM "Prescriptions" p
            WHERE p."VisitId" = v."Id"
              AND to_tsvector('russian', p."Drug") @@ plainto_tsquery('russian', {0}))
        """;

    // Полнотекстовый поиск по жалобе, диагнозу или назначенным препаратам
    // (индексы ix_visits_complaint_fts, ix_visits_diagnosis_fts, ix_prescriptions_drug_fts)
    public async Task<IReadOnlyList<VisitRow>> SearchAsync(string text, SearchScope scope, int page, CancellationToken ct = default)
    {
        var sql = scope switch
        {
            SearchScope.Complaint => ComplaintSearchSql,
            SearchScope.Diagnosis => DiagnosisSearchSql,
            SearchScope.Drug => DrugSearchSql,
            _ => throw new ArgumentOutOfRangeException(nameof(scope))
        };

        return await db.Visits
            .FromSqlRaw(sql, text)
            .OrderByDescending(v => v.SlotStart)
            // в одном слоте бывает несколько визитов - без доп. ключа страницы «плавают»
            .ThenByDescending(v => v.Id)
            .Skip(page * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync(ct);
    }

    // Карточка последнего состоявшегося визита питомца (запланированные и отменённые не учитываются).
    // При совместном приёме в одном слоте берётся визит с большим Id.
    public async Task<LastVisitCard?> GetLastVisitCardAsync(int petId, CancellationToken ct = default)
    {
        var v = await db.Visits
            .AsNoTracking()
            .Where(v => v.PetId == petId
                && (v.Status == VisitStatus.Completed || v.Status == VisitStatus.InProgress))
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id)
            .Select(v => new
            {
                v.Id,
                v.SlotStart,
                v.Status,
                v.Complaint,
                v.Diagnosis,
                v.PetId,
                PetName = v.Pet.Name,
                PetSpecies = v.Pet.Species,
                v.VetId,
                VetName = v.Vet.FullName,
                LabResults = v.LabResults
                    .OrderBy(r => r.TakenAt).ThenBy(r => r.Id)
                    .Select(r => new { r.Id, r.TestCode, r.Value, r.Unit, r.TakenAt })
                    .ToList(),
                Prescriptions = v.Prescriptions
                    .OrderBy(p => p.Id)
                    .Select(p => new PrescriptionItem(p.Id, p.Drug, p.Dosage, p.Days))
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (v is null)
            return null;

        return new LastVisitCard(
            v.Id,
            ToLocal(v.SlotStart),
            v.Status,
            v.Complaint,
            v.Diagnosis,
            v.PetId,
            v.PetName,
            v.PetSpecies,
            v.VetId,
            v.VetName,
            v.LabResults.Select(r => new LabResultItem(r.Id, r.TestCode, r.Value, r.Unit, ToLocal(r.TakenAt))).ToList(),
            v.Prescriptions);
    }

    // Выгрузка приёмов врача за период [from; to] (местные даты клиники, обе включительно).
    // Пишет CSV потоково: до 100 тыс. строк не держим в памяти ни сущностями, ни одной строкой.
    // Учитываются состоявшиеся приёмы (Completed, InProgress).
    public async Task ExportVetVisitsCsvAsync(int vetId, DateOnly from, DateOnly to, Stream output, CancellationToken ct = default)
    {
        if (to < from)
            throw new ArgumentException("Дата окончания периода раньше даты начала.", nameof(to));

        var fromUtc = LocalDateStartToUtc(from);
        var toUtcExclusive = LocalDateStartToUtc(to.AddDays(1));

        var rows = db.Visits
            .AsNoTracking()
            .Where(v => v.VetId == vetId
                && v.SlotStart >= fromUtc && v.SlotStart < toUtcExclusive
                && (v.Status == VisitStatus.Completed || v.Status == VisitStatus.InProgress))
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

        // UTF-8 с BOM и разделитель ';' - чтобы файл корректно открывался в Excel с русской локалью
        await using var writer = new StreamWriter(output, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), bufferSize: 64 * 1024, leaveOpen: true);
        writer.NewLine = "\r\n";

        await writer.WriteLineAsync("Дата и время приёма;Кличка;Жалоба;Диагноз;Число назначений");

        await foreach (var r in rows.WithCancellation(ct))
        {
            var line = string.Join(';',
                ToLocal(r.SlotStart).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                CsvField(r.PetName),
                CsvField(r.Complaint),
                CsvField(r.Diagnosis),
                r.PrescriptionCount.ToString(CultureInfo.InvariantCulture));
            await writer.WriteLineAsync(line);
        }

        await writer.FlushAsync(ct);
    }

    private static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), ClinicTimeZone);

    private static DateTime LocalDateStartToUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), ClinicTimeZone);

    private static string CsvField(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        // защита от CSV-инъекций формул при открытии в табличных редакторах
        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            value = "'" + value;

        if (value.IndexOfAny([';', '"', '\r', '\n']) >= 0)
            value = "\"" + value.Replace("\"", "\"\"") + "\"";

        return value;
    }
}
```

## Program.cs
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

app.MapGet("/journal/search", async (string q, string? scope, int page, VisitJournalService s, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(q))
        return Results.BadRequest("Пустой поисковый запрос.");
    if (page < 0)
        return Results.BadRequest("Номер страницы не может быть отрицательным.");

    // без scope ищем по жалобе, как раньше
    SearchScope? parsed = (scope ?? "complaint").ToLowerInvariant() switch
    {
        "complaint" => SearchScope.Complaint,
        "diagnosis" => SearchScope.Diagnosis,
        "drug" => SearchScope.Drug,
        _ => null
    };
    if (parsed is null)
        return Results.BadRequest("scope: допустимые значения complaint | diagnosis | drug.");

    return Results.Ok(await s.SearchAsync(q, parsed.Value, page, ct));
});

app.MapGet("/pets/{petId:int}/last-visit", async (int petId, VisitJournalService s, CancellationToken ct) =>
    await s.GetLastVisitCardAsync(petId, ct) is { } card ? Results.Ok(card) : Results.NotFound());

app.MapGet("/vets/{vetId:int}/visits.csv", (int vetId, DateOnly from, DateOnly to, VisitJournalService s, CancellationToken ct) =>
{
    if (to < from)
        return Results.BadRequest("Дата окончания периода раньше даты начала.");

    return Results.Stream(
        stream => s.ExportVetVisitsCsvAsync(vetId, from, to, stream, ct),
        contentType: "text/csv; charset=utf-8",
        fileDownloadName: $"visits_vet{vetId}_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.csv");
});

app.Run();
```