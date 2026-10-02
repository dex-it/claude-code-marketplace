Все три доработки сделаны. Сборку и тесты я не запускал, так что код не проверен. До выкладки на прод нужно сверить одну вещь: каталога `Migrations` в репозитории не было, хотя README на него ссылается. Поэтому снимок модели EF я написал вручную, по текущей модели.

## Файлы

Изменены:
- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicCardService.cs` — `VisitDto.Anamnesis`, `DeleteOwnerAsync`, `ReplaceAllergiesAsync`, `UpdateVisitNotesAsync` → `UpdateVisitAnamnesisAsync`.
- `src/VetClinic.Records/Program.cs` — `DELETE /owners/{id}`, `PUT /pets/{id}/allergies` (полный список в теле), `PUT /visits/{id}/notes` → `PUT /visits/{id}/anamnesis`.

Созданы:
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs` — миграция, написана вручную.
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs` — снимок модели, написан вручную.
- `_answer.md` — этот ответ.

## Решения

- **Удаление клиента.** По README записи физически не удаляются, поэтому удаление мягкое. В одной транзакции `ExecuteUpdate` ставит `IsDeleted`/`DeletedAt` клиенту, его питомцам, их визитам и аллергиям, у всех одинаковый `DeletedAt` — так поддержка сможет восстановить всё вместе. Каскад нужен потому, что фильтр `Visit` проверяет только свой `IsDeleted`: без каскада визиты удалённого клиента остались бы в расписании врача.
- **Аллергии.** Совпадающие записи (аллерген, реакция, тяжесть) остаются как есть. Пропавшие и изменённые помечаются удалёнными, а не удаляются из коллекции — иначе EF удалил бы строки из БД по обязательной связи. Изменённые и новые записи добавляются новыми строками, так история сохраняется. Пустой аллерген, повтор одного аллергена или неизвестная тяжесть дают ответ 400, несуществующий питомец — 404.
- **Анамнез.** Миграция использует `RenameColumn`, а не удаление и добавление столбца, поэтому данные не теряются и откат работает через `Down`. Выкладка по `.gitlab-ci.yml` делается за один релиз: приложение в это время остановлено, у `vet_app` нет прав на изменение схемы, и миграции при старте приложения не запускаются. Внешний API меняется: поле `notes` → `anamnesis`, путь `/notes` → `/anamnesis`. Фронтенд нужно выкатить вместе с сервисом.

**Перед выкладкой:**
- Сверить снимок модели с прод-таблицей `__EFMigrationsHistory`.
- Проверить его командой `dotnet ef migrations has-pending-model-changes`.
- Посмотреть `artifacts/migrate.sql`: в нём должен быть только `RENAME COLUMN`.

## Содержимое файлов

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

    // Мягкое удаление клиента вместе с питомцами, их аллергиями и визитами (README: физически не удаляем).
    // Фильтр Visit смотрит только на свой IsDeleted, поэтому помечаем каскадно, иначе визиты
    // остались бы в расписании врачей. Общий DeletedAt позволяет поддержке восстановить всё вместе;
    // записи, удалённые раньше, фильтры не пропускают — их DeletedAt не перезаписывается.
    // Возвращает false, если клиента нет (или он уже удалён).
    public async Task<bool> DeleteOwnerAsync(int ownerId)
    {
        var now = DateTime.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync();

        // Сначала владелец: UPDATE блокирует строку до конца транзакции.
        var affected = await db.Owners
            .Where(o => o.Id == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.IsDeleted, true)
                .SetProperty(o => o.DeletedAt, now));
        if (affected == 0)
            return false;

        var petIds = await db.Pets
            .Where(p => p.OwnerId == ownerId)
            .Select(p => p.Id)
            .ToListAsync();

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
            .Where(p => petIds.Contains(p.Id))
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.IsDeleted, true)
                .SetProperty(p => p.DeletedAt, now));

        await tx.CommitAsync();
        return true;
    }

    // Полная замена списка аллергий. Совпадающие записи (аллерген, реакция, тяжесть) остаются как есть,
    // исчезнувшие и изменённые помечаются удалёнными, новые/изменённые добавляются новыми строками —
    // так история аллергий сохраняется. Возвращает false, если питомца нет.
    public async Task<bool> ReplaceAllergiesAsync(int petId, IReadOnlyList<AllergyInput> allergies)
    {
        var incoming = Normalize(allergies);

        var pet = await db.Pets
            .Include(p => p.Allergies)
            .SingleOrDefaultAsync(p => p.Id == petId);
        if (pet is null)
            return false;

        var existing = pet.Allergies.ToList();
        var kept = new HashSet<Allergy>();

        foreach (var input in incoming)
        {
            var same = existing.FirstOrDefault(a =>
                !kept.Contains(a)
                && a.Allergen == input.Allergen
                && a.Reaction == input.Reaction
                && a.Severity == input.Severity);

            if (same is not null)
                kept.Add(same);
            else
                pet.Allergies.Add(new Allergy
                {
                    Allergen = input.Allergen,
                    Reaction = input.Reaction,
                    Severity = input.Severity
                });
        }

        var now = DateTime.UtcNow;
        foreach (var allergy in existing.Where(a => !kept.Contains(a)))
        {
            // Не удаляем из коллекции: для обязательной связи EF удалил бы строку физически.
            allergy.IsDeleted = true;
            allergy.DeletedAt = now;
        }

        await db.SaveChangesAsync();
        return true;
    }

    private static List<AllergyInput> Normalize(IReadOnlyList<AllergyInput> allergies)
    {
        ArgumentNullException.ThrowIfNull(allergies);

        var result = new List<AllergyInput>(allergies.Count);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var a in allergies)
        {
            var allergen = a?.Allergen?.Trim();
            if (string.IsNullOrEmpty(allergen))
                throw new ArgumentException("Не указан аллерген.");
            if (allergen.Length > 200)
                throw new ArgumentException($"Слишком длинное название аллергена: {allergen[..50]}…");
            if (!Enum.IsDefined(a!.Severity))
                throw new ArgumentException($"Неизвестная тяжесть реакции у аллергена «{allergen}».");
            if (!seen.Add(allergen))
                throw new ArgumentException($"Аллерген «{allergen}» указан дважды.");

            var reaction = string.IsNullOrWhiteSpace(a.Reaction) ? null : a.Reaction.Trim();
            result.Add(new AllergyInput(allergen, reaction, a.Severity));
        }
        return result;
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

app.MapDelete("/owners/{id:int}", async (int id, ClinicCardService s) =>
    await s.DeleteOwnerAsync(id) ? Results.NoContent() : Results.NotFound());

app.MapPost("/pets/{id:int}/allergies", async (int id, AllergyInput input, ClinicCardService s) =>
{
    await s.AddAllergyAsync(id, input);
    return Results.NoContent();
});

app.MapPut("/pets/{id:int}/allergies", async (int id, List<AllergyInput> allergies, ClinicCardService s) =>
{
    try
    {
        return await s.ReplaceAllergiesAsync(id, allergies) ? Results.NoContent() : Results.NotFound();
    }
    catch (ArgumentException e)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["allergies"] = [e.Message] });
    }
});

app.MapPut("/visits/{id:int}/anamnesis", async (int id, string? anamnesis, ClinicCardService s) =>
{
    await s.UpdateVisitAnamnesisAsync(id, anamnesis);
    return Results.NoContent();
});

app.Run();
```

### `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs`
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    /// <summary>
    /// Visit.Notes -> Visit.Anamnesis. Именно RenameColumn (ALTER TABLE ... RENAME COLUMN):
    /// данные сохраняются, операция только меняет метаданные. Написано вручную —
    /// не заменять на DropColumn/AddColumn, которые сгенерировал бы автодифф без подсказки.
    /// </summary>
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002090000_RenameVisitNotesToAnamnesis")]
    public partial class RenameVisitNotesToAnamnesis : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Notes",
                table: "Visits",
                newName: "Anamnesis");
        }

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

### `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`
```csharp
// <auto-generated />
using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    [DbContext(typeof(ClinicDbContext))]
    partial class ClinicDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.8")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("VetClinic.Records.Domain.Allergy", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("integer");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<int>("Id"));

                    b.Property<string>("Allergen")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("boolean");

                    b.Property<int>("PetId")
                        .HasColumnType("integer");

                    b.Property<string>("Reaction")
                        .HasColumnType("text");

                    b.Property<int>("Severity")
                        .HasColumnType("integer");

                    b.HasKey("Id");

                    b.HasIndex("PetId");

                    b.ToTable("Allergies");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Owner", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("integer");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<int>("Id"));

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<string>("FullName")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("boolean");

                    b.Property<string>("Phone")
                        .IsRequired()
                        .HasMaxLength(11)
                        .HasColumnType("character varying(11)");

                    b.HasKey("Id");

                    b.ToTable("Owners");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Pet", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("integer");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<int>("Id"));

                    b.Property<DateOnly>("BirthDate")
                        .HasColumnType("date");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("boolean");

                    b.Property<string>("Name")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("character varying(100)");

                    b.Property<int>("OwnerId")
                        .HasColumnType("integer");

                    b.Property<string>("Species")
                        .IsRequired()
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("OwnerId");

                    b.ToTable("Pets");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Visit", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("integer");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<int>("Id"));

                    b.Property<string>("Anamnesis")
                        .HasColumnType("text");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("boolean");

                    b.Property<int>("PetId")
                        .HasColumnType("integer");

                    b.Property<DateTime>("ScheduledAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<int>("Status")
                        .HasColumnType("integer");

                    b.Property<string>("VetName")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)");

                    b.HasKey("Id");

                    b.HasIndex("PetId");

                    b.HasIndex("VetName", "Status", "ScheduledAt");

                    b.ToTable("Visits");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Allergy", b =>
                {
                    b.HasOne("VetClinic.Records.Domain.Pet", "Pet")
                        .WithMany("Allergies")
                        .HasForeignKey("PetId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Pet");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Pet", b =>
                {
                    b.HasOne("VetClinic.Records.Domain.Owner", "Owner")
                        .WithMany("Pets")
                        .HasForeignKey("OwnerId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Owner");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Visit", b =>
                {
                    b.HasOne("VetClinic.Records.Domain.Pet", "Pet")
                        .WithMany("Visits")
                        .HasForeignKey("PetId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Pet");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Owner", b =>
                {
                    b.Navigation("Pets");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Pet", b =>
                {
                    b.Navigation("Allergies");

                    b.Navigation("Visits");
                });
#pragma warning restore 612, 618
        }
    }
}
```