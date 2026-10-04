Все три доработки сделаны, эндпоинты добавлены в `Program.cs`. Сборку и тесты не запускал. Этот же ответ записан в `_answer.md`.

## Файлы

- `VisitJournalService.cs` (изменён): поиск с параметром `scope`, карточка последнего визита, выгрузка CSV.
- `Program.cs` (изменён): параметр `scope` у `/journal/search`, новые эндпоинты `/pets/{petId}/last-visit` и `/vets/{vetId}/visits.csv?from=&to=`.
- `ClinicTime.cs` (новый): перевод между UTC и временем `Asia/Yekaterinburg`.
- `_answer.md`: этот ответ.

## Решения

- **Поиск.** Вместо `FromSqlRaw` поиск теперь на LINQ через `EF.Functions.ToTsVector("russian", …).Matches(PlainToTsQuery(…))`. Выражения повторяют индексы из README, включая `coalesce` для диагноза. Поиск по препарату идёт через `EXISTS` по таблице назначений. Текст запроса передаётся параметром, `'russian'` — константой. Без `scope` ищем по жалобе, неизвестное значение даёт 400. Формат строки и размер страницы прежние; для стабильных страниц добавлена сортировка по `Id` после даты.
- **Карточка.** Питомец может быть в одном слоте у нескольких врачей (совместный приём). Поэтому метод возвращает все визиты последнего слота, а не выбирает один молча. Обычно визит один; если визитов нет — 404. Анализы и назначения загружаются двумя split-запросами.
- **CSV.** Даты переводятся в UTC-интервал от `from` 00:00 до `to`+1 00:00 по Екатеринбургу, запрос попадает в индекс `(VetId, SlotStart)`. Строки читаются потоком и сразу пишутся в ответ, так что 100 тыс. строк не собираются в памяти. Число назначений считается в SQL. Формат файла: UTF-8 с BOM, разделитель `;` (чтобы Excel с русской локалью открыл его сразу).

**Нужно ваше решение:** я сам решил, какие статусы считать. «Последний визит» — только `Completed` или `InProgress`, в выгрузку попадают только `Completed`. Если бухгалтерии нужны и другие статусы, меняется одно условие.

---

### ClinicTime.cs (новый)
```csharp
namespace VetClinic.Journal.Services;

// Местное время клиники (Екатеринбург). В БД моменты хранятся в UTC (timestamptz, Kind=Utc).
public static class ClinicTime
{
    public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Yekaterinburg");

    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    // Начало местных суток в UTC (Kind=Utc - для параметра timestamptz)
    public static DateTime StartOfDayUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Zone);
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

public record LabResultItem(int Id, string TestCode, decimal Value, string Unit, DateTime TakenAtUtc, DateTime TakenAtLocal);

public record PrescriptionItem(int Id, string Drug, string Dosage, int Days);

public record VisitCard(
    int VisitId,
    DateTime SlotStartUtc,
    DateTime SlotStartLocal,
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

    // Полнотекстовый поиск. Выражения to_tsvector совпадают с индексами из README:
    // complaint - ix_visits_complaint_fts, diagnosis - ix_visits_diagnosis_fts (coalesce), drug - ix_prescriptions_drug_fts.
    // Текст запроса идёт параметром, конфигурация 'russian' - константой (иначе индекс не подойдёт).
    public async Task<IReadOnlyList<VisitRow>> SearchAsync(string text, SearchScope scope, int page)
    {
        var visits = scope switch
        {
            SearchScope.Complaint => db.Visits.Where(v =>
                EF.Functions.ToTsVector("russian", v.Complaint)
                    .Matches(EF.Functions.PlainToTsQuery("russian", text))),

            SearchScope.Diagnosis => db.Visits.Where(v =>
                EF.Functions.ToTsVector("russian", v.Diagnosis ?? "")
                    .Matches(EF.Functions.PlainToTsQuery("russian", text))),

            SearchScope.Drug => db.Visits.Where(v =>
                v.Prescriptions.Any(p =>
                    EF.Functions.ToTsVector("russian", p.Drug)
                        .Matches(EF.Functions.PlainToTsQuery("russian", text)))),

            _ => throw new ArgumentOutOfRangeException(nameof(scope))
        };

        return await visits
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id)
            .Skip(page * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync();
    }

    // Карточка последнего состоявшегося визита (InProgress/Completed). Питомец может быть в одном слоте
    // у нескольких врачей (совместный приём), поэтому "последний визит" не всегда один:
    // возвращаются все визиты последнего слота; пустой список - визитов нет.
    public async Task<IReadOnlyList<VisitCard>> GetLastVisitCardAsync(int petId)
    {
        var held = db.Visits.Where(v => v.PetId == petId
            && (v.Status == VisitStatus.Completed || v.Status == VisitStatus.InProgress));

        var lastSlot = await held.MaxAsync(v => (DateTime?)v.SlotStart);
        if (lastSlot is null)
            return [];

        // две коллекции одного уровня - анализы и назначения грузятся split-запросами (настройка контекста)
        return await held
            .Where(v => v.SlotStart == lastSlot.Value)
            .OrderBy(v => v.Id)
            .Select(v => new VisitCard(
                v.Id,
                v.SlotStart,
                ClinicTime.ToLocal(v.SlotStart),
                v.Status,
                v.Complaint,
                v.Diagnosis,
                v.PetId,
                v.Pet.Name,
                v.Pet.Species,
                v.VetId,
                v.Vet.FullName,
                v.LabResults
                    .OrderBy(r => r.TakenAt).ThenBy(r => r.Id)
                    .Select(r => new LabResultItem(r.Id, r.TestCode, r.Value, r.Unit, r.TakenAt, ClinicTime.ToLocal(r.TakenAt)))
                    .ToList(),
                v.Prescriptions
                    .OrderBy(p => p.Id)
                    .Select(p => new PrescriptionItem(p.Id, p.Drug, p.Dosage, p.Days))
                    .ToList()))
            .ToListAsync();
    }

    // Выгрузка для бухгалтерии: состоявшиеся (Completed) приёмы врача, from..to включительно по местному времени.
    // До 100 тыс. строк - строки читаются потоком и сразу пишутся в output, в память выборка не собирается.
    public async Task ExportVetVisitsCsvAsync(int vetId, DateOnly from, DateOnly to, Stream output, CancellationToken ct = default)
    {
        if (to < from)
            throw new ArgumentException("Дата окончания раньше даты начала.", nameof(to));

        var fromUtc = ClinicTime.StartOfDayUtc(from);
        var toUtcExclusive = ClinicTime.StartOfDayUtc(to.AddDays(1));

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

        // UTF-8 с BOM и ';' - чтобы Excel с русской локалью открыл файл без мастера импорта
        await using var writer = new StreamWriter(output, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), leaveOpen: true);

        await writer.WriteLineAsync("Дата и время приёма;Кличка;Жалоба;Диагноз;Число назначений".AsMemory(), ct);

        await foreach (var r in rows.WithCancellation(ct))
        {
            var line = string.Join(';',
                Csv(ClinicTime.ToLocal(r.SlotStart).ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture)),
                Csv(r.PetName),
                Csv(r.Complaint),
                Csv(r.Diagnosis ?? ""),
                r.PrescriptionCount.ToString(CultureInfo.InvariantCulture));
            await writer.WriteLineAsync(line.AsMemory(), ct);
        }

        await writer.FlushAsync(ct);
    }

    private static string Csv(string value) =>
        value.IndexOfAny([';', '"', '\r', '\n']) >= 0
            ? "\"" + value.Replace("\"", "\"\"") + "\""
            : value;
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
    if (!VisitJournalService.TryParseScope(scope, out var searchScope))
        return Results.BadRequest("scope: complaint | diagnosis | drug");
    if (page < 0)
        return Results.BadRequest("page >= 0");

    return Results.Ok(await s.SearchAsync(q, searchScope, page));
});

app.MapGet("/pets/{petId:int}/last-visit", async (int petId, VisitJournalService s) =>
{
    var cards = await s.GetLastVisitCardAsync(petId);
    return cards.Count == 0 ? Results.NotFound() : Results.Ok(cards);
});

// from, to - даты по местному времени клиники (yyyy-MM-dd), обе включительно
app.MapGet("/vets/{vetId:int}/visits.csv", (int vetId, DateOnly from, DateOnly to, VisitJournalService s, CancellationToken ct) =>
{
    if (to < from)
        return Results.BadRequest("to < from");

    return Results.Stream(
        body => s.ExportVetVisitsCsvAsync(vetId, from, to, body, ct),
        contentType: "text/csv; charset=utf-8",
        fileDownloadName: $"visits_vet{vetId}_{from:yyyyMMdd}_{to:yyyyMMdd}.csv");
});

app.Run();
```