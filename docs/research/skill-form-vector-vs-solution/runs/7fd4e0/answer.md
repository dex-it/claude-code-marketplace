Я реализовал все три доработки в `VisitJournalService.cs` и добавил эндпоинты в `Program.cs`. Новых файлов нет, изменены только эти два, ответ записан в `_answer.md`. Сборку и тесты, как и было сказано, не запускал.

**Изменённые файлы:**
- `VisitJournalService.cs`: поиск с `scope`, `GetLastVisitCardAsync`, `ExportVetVisitsCsvAsync` и DTO.
- `Program.cs`: параметр `scope` в `/journal/search` и новые эндпоинты `GET /pets/{petId}/last-visit` и `GET /vets/{vetId}/visits/export?from=yyyy-MM-dd&to=yyyy-MM-dd`.

**Решения:**
- **Поиск.** Остался `FromSqlRaw`, но SQL выбирается из фиксированного списка по `scope`. Выражения `to_tsvector` в точности совпадают с индексами из README, включая `coalesce("Diagnosis", '')`, поэтому индексы используются. Поиск по препарату идёт через `EXISTS` по `"Prescriptions"`. Текст запроса передаётся только параметром. Без `scope` поиск идёт по жалобе, как раньше, а неизвестное значение возвращает 400. В сортировку я добавил `Id`: в одном слоте бывает несколько визитов, и без этого порядок между страницами не устойчив.
- **Карточка.** Всё загружается одним запросом с явным `AsSingleQuery()`. Для одного визита строк немного, а глобальный режим split query выбирал бы «последний визит» заново в каждом своём запросе. При совместном приёме в одном слоте визит выбирается однозначно, по `Id`. Время отдаётся по Екатеринбургу (+05:00).
- **CSV.** Местные даты переводятся в диапазон UTC `[from 00:00; to+1 00:00)`, поэтому запрос попадает в индекс `(VetId, SlotStart)`. Число назначений считает база. Строки читаются потоком и сразу пишутся в ответ, так что 100 тыс. строк не держатся в памяти. Файл в UTF-8 с BOM, разделитель `;`, чтобы Excel с русской локалью открывал его сразу. Текст, начинающийся с `=`, `+`, `-` или `@`, я защитил от выполнения как формулы.

**Нужно ваше решение:** в карточку и выгрузку попадают только визиты со статусом «идёт» или «завершён». Запланированные и отменённые я отбросил, но это моё предположение. Стоит подтвердить у врачей и бухгалтерии.

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

public record LabResultItem(int Id, string TestCode, decimal Value, string Unit, DateTimeOffset TakenAtLocal);

public record PrescriptionItem(int Id, string Drug, string Dosage, int Days);

public record LastVisitCard(
    int VisitId,
    DateTimeOffset SlotStartLocal,
    VisitStatus Status,
    int PetId,
    string PetName,
    int VetId,
    string VetName,
    string Complaint,
    string? Diagnosis,
    IReadOnlyList<LabResultItem> LabResults,
    IReadOnlyList<PrescriptionItem> Prescriptions);

public class VisitJournalService(ClinicDbContext db)
{
    private const int PageSize = 50;

    // Часовой пояс клиники (README): в БД - UTC, на экраны и в выгрузки - местное время
    private static readonly TimeZoneInfo ClinicTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Yekaterinburg");

    // Белый список SQL по области поиска. Выражения to_tsvector повторяют индексы из README
    // (ix_visits_complaint_fts, ix_visits_diagnosis_fts, ix_prescriptions_drug_fts), иначе индекс не используется.
    // Пользовательский текст уходит только параметром {0}.
    private static readonly Dictionary<SearchScope, string> SearchSql = new()
    {
        [SearchScope.Complaint] =
            """
            SELECT * FROM "Visits"
            WHERE to_tsvector('russian', "Complaint") @@ plainto_tsquery('russian', {0})
            """,
        [SearchScope.Diagnosis] =
            """
            SELECT * FROM "Visits"
            WHERE to_tsvector('russian', coalesce("Diagnosis", '')) @@ plainto_tsquery('russian', {0})
            """,
        [SearchScope.Drug] =
            """
            SELECT * FROM "Visits" v
            WHERE EXISTS (
                SELECT 1 FROM "Prescriptions" p
                WHERE p."VisitId" = v."Id"
                  AND to_tsvector('russian', p."Drug") @@ plainto_tsquery('russian', {0}))
            """
    };

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

    // Полнотекстовый поиск по жалобе, диагнозу или назначенным препаратам
    public async Task<IReadOnlyList<VisitRow>> SearchAsync(string text, int page, SearchScope scope = SearchScope.Complaint)
    {
        return await db.Visits
            .FromSqlRaw(SearchSql[scope], text)
            // Id - тай-брейкер: в одном слоте бывает несколько визитов, без него страницы «плывут»
            .OrderByDescending(v => v.SlotStart)
            .ThenByDescending(v => v.Id)
            .Skip(Math.Max(page, 0) * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync();
    }

    // Карточка последнего состоявшегося (идёт или завершён) визита питомца; null, если визитов нет
    public async Task<LastVisitCard?> GetLastVisitCardAsync(int petId, CancellationToken ct = default)
    {
        var v = await db.Visits
            .Where(x => x.PetId == petId
                        && (x.Status == VisitStatus.InProgress || x.Status == VisitStatus.Completed))
            // совместный приём даёт несколько визитов в одном слоте - выбор детерминирован по Id
            .OrderByDescending(x => x.SlotStart)
            .ThenByDescending(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.SlotStart,
                x.Status,
                x.PetId,
                PetName = x.Pet.Name,
                x.VetId,
                VetName = x.Vet.FullName,
                x.Complaint,
                x.Diagnosis,
                Labs = x.LabResults
                    .OrderBy(r => r.TakenAt).ThenBy(r => r.Id)
                    .Select(r => new { r.Id, r.TestCode, r.Value, r.Unit, r.TakenAt })
                    .ToList(),
                Prescriptions = x.Prescriptions
                    .OrderBy(p => p.Id)
                    .Select(p => new PrescriptionItem(p.Id, p.Drug, p.Dosage, p.Days))
                    .ToList()
            })
            // Один визит: декартово произведение анализы×назначения мало, а единый запрос
            // гарантирует, что коллекции относятся к тому же визиту, что выбран по ORDER BY/LIMIT
            // (глобальный SplitQuery повторил бы выбор «последнего» в каждом запросе).
            .AsSingleQuery()
            .FirstOrDefaultAsync(ct);

        if (v is null)
            return null;

        return new LastVisitCard(
            v.Id,
            ToLocal(v.SlotStart),
            v.Status,
            v.PetId,
            v.PetName,
            v.VetId,
            v.VetName,
            v.Complaint,
            v.Diagnosis,
            v.Labs.Select(r => new LabResultItem(r.Id, r.TestCode, r.Value, r.Unit, ToLocal(r.TakenAt))).ToList(),
            v.Prescriptions);
    }

    // CSV приёмов врача за период [from; to] по местным датам клиники. Строки читаются потоком
    // и сразу пишутся в output - выгрузка за год (до ~100 тыс. строк) не собирается в памяти.
    // В выгрузку попадают состоявшиеся приёмы (идёт / завершён); запланированные и отменённые - нет.
    public async Task ExportVetVisitsCsvAsync(int vetId, DateOnly from, DateOnly to, Stream output, CancellationToken ct = default)
    {
        if (to < from)
            throw new ArgumentException("Дата окончания периода раньше даты начала.", nameof(to));

        // Границы местных суток -> UTC (Kind=Utc, как требует timestamptz); правая граница исключающая
        var fromUtc = LocalDateStartToUtc(from);
        var toUtcExclusive = LocalDateStartToUtc(to.AddDays(1));

        var rows = db.Visits
            .Where(x => x.VetId == vetId
                        && x.SlotStart >= fromUtc && x.SlotStart < toUtcExclusive
                        && (x.Status == VisitStatus.InProgress || x.Status == VisitStatus.Completed))
            .OrderBy(x => x.SlotStart)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.SlotStart,
                PetName = x.Pet.Name,
                x.Complaint,
                x.Diagnosis,
                PrescriptionCount = x.Prescriptions.Count()
            })
            .AsAsyncEnumerable();

        // UTF-8 с BOM и ';' - чтобы Excel с русской локалью открыл файл без мастера импорта.
        // await using: финальный Flush должен быть асинхронным (Kestrel запрещает синхронный IO).
        await using var writer = new StreamWriter(output, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), bufferSize: 64 * 1024, leaveOpen: true);

        await writer.WriteLineAsync("Дата и время приёма;Кличка;Жалоба;Диагноз;Назначений");

        await foreach (var r in rows.WithCancellation(ct))
        {
            var line = string.Join(';',
                ToLocal(r.SlotStart).ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
                CsvField(r.PetName),
                CsvField(r.Complaint),
                CsvField(r.Diagnosis),
                r.PrescriptionCount.ToString(CultureInfo.InvariantCulture));
            await writer.WriteLineAsync(line.AsMemory(), ct);
        }

        await writer.FlushAsync();
    }

    private static DateTimeOffset ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTime(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)), ClinicTimeZone);

    private static DateTime LocalDateStartToUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), ClinicTimeZone);

    // RFC 4180 + защита от CSV-инъекции: текст врача/владельца, начинающийся с =,+,-,@,
    // Excel иначе выполнит как формулу.
    private static string CsvField(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            value = "'" + value;

        return value.IndexOfAny([';', '"', '\r', '\n']) >= 0
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
    VisitJournalService.TryParseScope(scope, out var parsed)
        ? Results.Ok(await s.SearchAsync(q, page, parsed))
        : Results.BadRequest("scope: complaint | diagnosis | drug"));

app.MapGet("/pets/{petId:int}/last-visit", async (int petId, VisitJournalService s, CancellationToken ct) =>
    await s.GetLastVisitCardAsync(petId, ct) is { } card
        ? Results.Ok(card)
        : Results.NotFound());

// from/to - местные даты клиники (yyyy-MM-dd), обе включительно
app.MapGet("/vets/{vetId:int}/visits/export", (int vetId, DateOnly from, DateOnly to, VisitJournalService s, HttpContext http) =>
    to < from
        ? Results.BadRequest("to раньше from")
        : Results.Stream(
            body => s.ExportVetVisitsCsvAsync(vetId, from, to, body, http.RequestAborted),
            contentType: "text/csv; charset=utf-8",
            fileDownloadName: $"visits_vet{vetId}_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.csv"));

app.Run();
```