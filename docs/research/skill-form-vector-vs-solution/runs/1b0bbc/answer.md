Все три доработки сделаны. Сборку и тесты я не запускал. Тот же ответ записан в `_answer.md`.

## Изменённые и созданные файлы
- `src/VetClinic.Records/Domain.cs` (изменён): `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicCardService.cs` (изменён): добавлены `DeleteOwnerAsync` и `ReplaceAllergiesAsync` с проверкой входных данных, в `VisitDto` поле `Notes` стало `Anamnesis`, метод `UpdateVisitNotesAsync` стал `UpdateVisitAnamnesisAsync`.
- `src/VetClinic.Records/Program.cs` (изменён): добавлены `DELETE /owners/{id}` и `PUT /pets/{id}/allergies` (в теле — полный список). Маршрут `PUT /visits/{id}/notes` заменён на `PUT /visits/{id}/anamnesis`, анамнез теперь передаётся в теле запроса.
- `src/VetClinic.Records/Migrations/20261002120000_RenameVisitNotesToAnamnesis.cs` (создан): переименование колонки `Notes` → `Anamnesis` и обратная миграция.
- `_answer.md` (создан): этот ответ.

## Решения
- **Удаление клиента.** По правилу из README записи физически не удаляются. Метод в одной транзакции помечает удалёнными клиента, его питомцев, их визиты и аллергии с одинаковым `DeletedAt`. Визиты нужно помечать явно: фильтр визитов не проверяет питомца и владельца, без этого запланированные визиты остались бы в расписании врача. По общему `DeletedAt` поддержка сможет восстановить ровно этот набор записей.
- **Замена аллергий.** Записи, совпавшие по аллергену (без учёта регистра), реакции и тяжести, остаются без изменений. Остальные помечаются удалёнными, новые добавляются, так что история сохраняется. Дубли, пустой аллерген или неверная тяжесть дают 400, неизвестный питомец — 404.
- **Переименование.** Одна миграция `RENAME COLUMN`. Это безопасно, потому что по `.gitlab-ci.yml` миграции запускаются в окно обслуживания, когда приложение остановлено. Прав на изменение схемы роли `vet_app` для этого не нужно.

## Что учесть перед выкладкой
- **Это ломающее изменение API:** в JSON визита поле `notes` стало `anamnesis`, старый маршрут убран. Фронтенд нужно выкатывать одновременно.
- **Откат:** вернуть только старую версию приложения нельзя, она обращается к колонке `Notes`. Сначала нужно откатить миграцию.
- **Снапшот модели:** в каталоге нет папки `Migrations` и файла снапшота `ClinicDbContextModelSnapshot.cs`, поэтому нужные атрибуты я поставил прямо в файл миграции. Если в основном репозитории снапшот есть, в нём нужно заменить `Notes` на `Anamnesis`. Иначе следующая сгенерированная миграция снова попытается переименовать колонку.
- **Проверка скрипта:** в `artifacts/migrate.sql` должна быть строка `ALTER TABLE "Visits" RENAME COLUMN "Notes" TO "Anamnesis";`.
- **Доступ:** в проекте нет авторизации, поэтому удалить клиента сейчас может кто угодно, а не только администратор.

Ниже файлы целиком.

### `src/VetClinic.Records/Domain.cs`
```csharp
namespace VetClinic.Records.Domain;

public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}

public class Owner : ISoftDeletable
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public List<Pet> Pets { get; set; } = new();
}

public class Pet : ISoftDeletable
{
    public int Id { get; set; }
    public int OwnerId { get; set; }
    public Owner Owner { get; set; } = null!;

    public string Name { get; set; } = "";
    public string Species { get; set; } = "";
    public DateOnly BirthDate { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public List<Allergy> Allergies { get; set; } = new();
    public List<Visit> Visits { get; set; } = new();
}

public enum AllergySeverity
{
    Mild = 1,
    Moderate = 2,
    Severe = 3
}

public class Allergy : ISoftDeletable
{
    public int Id { get; set; }
    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string Allergen { get; set; } = "";
    public string? Reaction { get; set; }
    public AllergySeverity Severity { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public enum VisitStatus
{
    Planned = 1,
    Completed = 2,
    Cancelled = 3
}

public class Visit : ISoftDeletable
{
    public int Id { get; set; }
    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string VetName { get; set; } = "";
    public DateTime ScheduledAt { get; set; }
    public VisitStatus Status { get; set; }
    public string? Anamnesis { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
```

### `src/VetClinic.Records/ClinicCardService.cs`
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Data;
using VetClinic.Records.Domain;

namespace VetClinic.Records.Services;

public record AllergyInput(string Allergen, string? Reaction, AllergySeverity Severity);
public record AllergyDto(int Id, string Allergen, string? Reaction, AllergySeverity Severity);
public record VisitDto(int Id, DateTime ScheduledAt, string VetName, VisitStatus Status, string? Anamnesis);
public record PetCardDto(int Id, string Name, string Species, string OwnerName,
    List<AllergyDto> Allergies, List<VisitDto> Visits);

public class ClinicCardService(ClinicDbContext db)
{
    public async Task<PetCardDto?> GetPetCardAsync(int petId) =>
        await db.Pets
            .Where(p => p.Id == petId)
            .Select(p => new PetCardDto(
                p.Id, p.Name, p.Species, p.Owner.FullName,
                p.Allergies
                    .Select(a => new AllergyDto(a.Id, a.Allergen, a.Reaction, a.Severity))
                    .ToList(),
                p.Visits
                    .OrderByDescending(v => v.ScheduledAt)
                    .Select(v => new VisitDto(v.Id, v.ScheduledAt, v.VetName, v.Status, v.Anamnesis))
                    .ToList()))
            .SingleOrDefaultAsync();

    // Расписание врача: все запланированные визиты
    public async Task<List<VisitDto>> GetPlannedVisitsAsync(string vetName) =>
        await db.Visits
            .Where(v => v.VetName == vetName && v.Status == VisitStatus.Planned)
            .OrderBy(v => v.ScheduledAt)
            .Select(v => new VisitDto(v.Id, v.ScheduledAt, v.VetName, v.Status, v.Anamnesis))
            .ToListAsync();

    public async Task AddAllergyAsync(int petId, AllergyInput input)
    {
        var pet = await db.Pets.SingleAsync(p => p.Id == petId);
        pet.Allergies.Add(new Allergy
        {
            Allergen = input.Allergen.Trim(),
            Reaction = input.Reaction,
            Severity = input.Severity
        });
        await db.SaveChangesAsync();
    }

    // Полная замена списка аллергий. Физически ничего не удаляем (история 5 лет):
    // совпадающие записи остаются как есть, остальные помечаются удалёнными, новые добавляются.
    // Изменение реакции/тяжести = старая запись удалена + новая создана, чтобы история сохранилась.
    public async Task<bool> ReplaceAllergiesAsync(int petId, IReadOnlyList<AllergyInput> inputs)
    {
        var desired = NormalizeAllergies(inputs);

        var pet = await db.Pets
            .Include(p => p.Allergies)
            .SingleOrDefaultAsync(p => p.Id == petId);
        if (pet is null)
            return false;

        var now = DateTime.UtcNow;
        var toAdd = desired.ToList();
        foreach (var existing in pet.Allergies)
        {
            var same = toAdd.FirstOrDefault(i =>
                string.Equals(i.Allergen, existing.Allergen, StringComparison.OrdinalIgnoreCase)
                && i.Reaction == existing.Reaction
                && i.Severity == existing.Severity);
            if (same is not null)
            {
                toAdd.Remove(same);
                continue;
            }

            existing.IsDeleted = true;
            existing.DeletedAt = now;
        }

        foreach (var input in toAdd)
        {
            pet.Allergies.Add(new Allergy
            {
                Allergen = input.Allergen,
                Reaction = input.Reaction,
                Severity = input.Severity
            });
        }

        await db.SaveChangesAsync();
        return true;
    }

    private static List<AllergyInput> NormalizeAllergies(IReadOnlyList<AllergyInput>? inputs)
    {
        if (inputs is null)
            throw new ArgumentException("Список аллергий обязателен (пустой список — нет аллергий).");

        var result = new List<AllergyInput>(inputs.Count);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var i in inputs)
        {
            var allergen = i?.Allergen?.Trim();
            if (string.IsNullOrEmpty(allergen))
                throw new ArgumentException("Аллерген не может быть пустым.");
            if (allergen.Length > 200)
                throw new ArgumentException($"Аллерген «{allergen[..20]}…» длиннее 200 символов.");
            if (!Enum.IsDefined(i!.Severity))
                throw new ArgumentException($"Некорректная тяжесть для аллергена «{allergen}».");
            if (!seen.Add(allergen))
                throw new ArgumentException($"Аллерген «{allergen}» указан несколько раз.");

            var reaction = string.IsNullOrWhiteSpace(i.Reaction) ? null : i.Reaction.Trim();
            result.Add(new AllergyInput(allergen, reaction, i.Severity));
        }
        return result;
    }

    // «Удаление» клиента — мягкое (см. README): помечаем клиента, его питомцев и все их визиты
    // и аллергии одним DeletedAt, чтобы поддержка могла восстановить ровно этот набор.
    // Визиты и аллергии помечаем явно: фильтр Visit не смотрит на питомца/владельца,
    // иначе запланированные визиты остались бы в расписании врача.
    public async Task<bool> DeleteOwnerAsync(int ownerId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();

        if (!await db.Owners.AnyAsync(o => o.Id == ownerId))
            return false;

        var now = DateTime.UtcNow;
        var petIds = db.Pets.Where(p => p.OwnerId == ownerId).Select(p => p.Id);

        // Порядок важен: визиты и аллергии ищем через ещё не помеченных питомцев.
        await db.Visits
            .Where(v => petIds.Contains(v.PetId))
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.IsDeleted, true)
                .SetProperty(v => v.DeletedAt, now));

        await db.Allergies
            .Where(a => petIds.Contains(a.PetId))
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.IsDeleted, true)
                .SetProperty(a => a.DeletedAt, now));

        await db.Pets
            .Where(p => p.OwnerId == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.IsDeleted, true)
                .SetProperty(p => p.DeletedAt, now));

        await db.Owners
            .Where(o => o.Id == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.IsDeleted, true)
                .SetProperty(o => o.DeletedAt, now));

        await tx.CommitAsync();
        return true;
    }

    public async Task UpdateVisitAnamnesisAsync(int visitId, string? anamnesis)
    {
        var visit = await db.Visits.SingleAsync(v => v.Id == visitId);
        visit.Anamnesis = anamnesis;
        await db.SaveChangesAsync();
    }
}
```

### `src/VetClinic.Records/Program.cs`
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Data;
using VetClinic.Records.Domain;
using VetClinic.Records.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ClinicDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Records")));
builder.Services.AddScoped<ClinicCardService>();

var app = builder.Build();

app.MapGet("/pets/{id:int}", async (int id, ClinicCardService s) =>
    await s.GetPetCardAsync(id) is { } card ? Results.Ok(card) : Results.NotFound());

app.MapGet("/vets/{vetName}/planned", (string vetName, ClinicCardService s) =>
    s.GetPlannedVisitsAsync(vetName));

app.MapPost("/pets/{id:int}/allergies", async (int id, AllergyInput input, ClinicCardService s) =>
{
    await s.AddAllergyAsync(id, input);
    return Results.NoContent();
});

// Полная замена списка аллергий: тело — новый полный список (пустой массив = аллергий нет).
app.MapPut("/pets/{id:int}/allergies", async (int id, List<AllergyInput> allergies, ClinicCardService s) =>
{
    try
    {
        return await s.ReplaceAllergiesAsync(id, allergies) ? Results.NoContent() : Results.NotFound();
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapDelete("/owners/{id:int}", async (int id, ClinicCardService s) =>
    await s.DeleteOwnerAsync(id) ? Results.NoContent() : Results.NotFound());

// Анамнез передаётся в теле, а не в query string: медицинский текст не должен попадать в логи URL.
app.MapPut("/visits/{id:int}/anamnesis", async (int id, UpdateAnamnesisRequest body, ClinicCardService s) =>
{
    await s.UpdateVisitAnamnesisAsync(id, body.Anamnesis);
    return Results.NoContent();
});

app.Run();

public record UpdateAnamnesisRequest(string? Anamnesis);
```

### `src/VetClinic.Records/Migrations/20261002120000_RenameVisitNotesToAnamnesis.cs`
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    // Написана вручную (dotnet ef недоступен), поэтому атрибуты стоят здесь, а не в .Designer.cs.
    // RENAME COLUMN в PostgreSQL — изменение только метаданных: данные не копируются, таблица
    // блокируется на миг. Выполняется в окно обслуживания, когда старая версия приложения остановлена.
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002120000_RenameVisitNotesToAnamnesis")]
    public partial class RenameVisitNotesToAnamnesis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Notes",
                table: "Visits",
                newName: "Anamnesis");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Anamnesis",
                table: "Visits",
                newName: "Notes");
        }
    }
}
```