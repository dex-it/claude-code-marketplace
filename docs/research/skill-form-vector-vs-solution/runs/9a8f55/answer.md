Сделал все три доработки. Сборку и тесты я не запускал (по условию), так что код не проверен. Этот же ответ записан в `_answer.md`.

## Файлы
Изменены: `src/VetClinic.Records/Domain.cs`, `ClinicDbContext.cs`, `ClinicCardService.cs`, `Program.cs`.
Созданы вручную: `Migrations/20261002120000_AnamnesisAllergiesVersionRestrictFks.cs`, `Migrations/ClinicDbContextModelSnapshot.cs`.

## Решения
- **(а) Удаление клиента — мягкое, как требует README.** `DELETE /owners/{id}` в одной транзакции помечает `IsDeleted` у клиента, его питомцев, аллергий и визитов. У всех записей один `DeletedAt`, поэтому поддержка может восстановить их одним пакетом. Глобальные фильтры связаны: питомец скрыт, если скрыт клиент; визит и аллергия скрыты, если скрыт питомец. У внешних ключей `CASCADE` заменён на `RESTRICT`, чтобы физическое удаление не стёрло историю.
- **(б) Замена аллергий.** Аллергии без изменений остаются как есть. Удалённые и изменённые помечаются `IsDeleted`, изменённые и новые добавляются новыми строками, так что история сохраняется.
  - **Отступление от заданной сигнатуры:** я добавил третий параметр `expectedVersion`. Это значение `Pet.AllergiesVersion` (concurrency token), которое теперь отдаётся в карточке питомца. Без него при одновременной правке двумя администраторами одна правка молча затёрла бы другую. Если версия не совпадает — ответ 409.
- **(в) Анамнез.** В БД — `RENAME COLUMN`, данные остаются на месте. Выкладка идёт по текущему процессу из CI: SQL-скрипт → проверка DBA → `db-migrate` при остановленном приложении → `deploy`. Старый код с новой схемой работать не будет, поэтому порядок шагов обязателен.

**Что нужно проверить:**
- **API ломает совместимость:** старый маршрут `/notes` теперь `/anamnesis`, поле `notes` переименовано в `anamnesis`, для замены аллергий нужна версия. Фронтенд надо выкатывать вместе с этой версией.
- **В репозитории не было папки `Migrations`**, поэтому снапшот модели я написал с нуля. Имена внешних ключей в миграции взяты по соглашению EF; перед запуском DBA должен сверить их с реальной схемой прода.
- **В репозитории нет `.csproj`, `tests/` и `dotnet-tools.json`**, на которые ссылается CI. Без них CI не соберёт ни проект, ни SQL-скрипт миграций.

---

### src/VetClinic.Records/Domain.cs
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

    // Версия списка аллергий (concurrency token): растёт при каждом изменении списка
    public int AllergiesVersion { get; set; }

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

### src/VetClinic.Records/ClinicDbContext.cs
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Domain;

namespace VetClinic.Records.Data;

public class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Owner> Owners => Set<Owner>();
    public DbSet<Pet> Pets => Set<Pet>();
    public DbSet<Allergy> Allergies => Set<Allergy>();
    public DbSet<Visit> Visits => Set<Visit>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Фильтры зависимых согласованы с фильтром principal: запись скрыта, если скрыт её владелец/питомец.
        // FK без ON DELETE CASCADE: записи медкарты физически не удаляются (см. README).
        b.Entity<Owner>(e =>
        {
            e.HasQueryFilter(o => !o.IsDeleted);
            e.Property(o => o.FullName).HasMaxLength(200);
            e.Property(o => o.Phone).HasMaxLength(11);
        });

        b.Entity<Pet>(e =>
        {
            e.HasQueryFilter(p => !p.IsDeleted && !p.Owner.IsDeleted);
            e.Property(p => p.Name).HasMaxLength(100);
            e.Property(p => p.AllergiesVersion).IsConcurrencyToken();
            e.HasOne(p => p.Owner).WithMany(o => o.Pets).HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Allergy>(e =>
        {
            e.HasQueryFilter(a => !a.IsDeleted && !a.Pet.IsDeleted);
            e.Property(a => a.Allergen).HasMaxLength(200);
            e.HasOne(a => a.Pet).WithMany(p => p.Allergies).HasForeignKey(a => a.PetId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Visit>(e =>
        {
            e.HasQueryFilter(v => !v.IsDeleted && !v.Pet.IsDeleted);
            e.Property(v => v.VetName).HasMaxLength(200);
            e.HasOne(v => v.Pet).WithMany(p => p.Visits).HasForeignKey(v => v.PetId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(v => new { v.VetName, v.Status, v.ScheduledAt });
        });
    }
}
```

### src/VetClinic.Records/ClinicCardService.cs
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Data;
using VetClinic.Records.Domain;

namespace VetClinic.Records.Services;

public record AllergyInput(string Allergen, string? Reaction, AllergySeverity Severity);
public record AllergyDto(int Id, string Allergen, string? Reaction, AllergySeverity Severity);
public record VisitDto(int Id, DateTime ScheduledAt, string VetName, VisitStatus Status, string? Anamnesis);
public record PetCardDto(int Id, string Name, string Species, string OwnerName, int AllergiesVersion,
    List<AllergyDto> Allergies, List<VisitDto> Visits);

public enum ReplaceAllergiesResult
{
    Replaced,
    PetNotFound,
    Invalid,
    // Список изменён другим пользователем после того, как форма была открыта
    Conflict
}

public class ClinicCardService(ClinicDbContext db)
{
    public async Task<PetCardDto?> GetPetCardAsync(int petId) =>
        await db.Pets
            .Where(p => p.Id == petId)
            .Select(p => new PetCardDto(
                p.Id, p.Name, p.Species, p.Owner.FullName, p.AllergiesVersion,
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

    // Мягкое удаление клиента вместе с питомцами, аллергиями и визитами одной транзакцией.
    // Все записи получают один DeletedAt - поддержка может восстановить их пакетом.
    public async Task<bool> DeleteOwnerAsync(int ownerId)
    {
        var now = DateTime.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync();

        // Фильтр Owner отсекает уже удалённого клиента; UPDATE блокирует строку клиента до Commit
        var deleted = await db.Owners
            .Where(o => o.Id == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.IsDeleted, true)
                .SetProperty(o => o.DeletedAt, now));
        if (deleted == 0)
            return false;

        await db.Visits
            .IgnoreQueryFilters()
            .Where(v => v.Pet.OwnerId == ownerId && !v.IsDeleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.IsDeleted, true)
                .SetProperty(v => v.DeletedAt, now));

        await db.Allergies
            .IgnoreQueryFilters()
            .Where(a => a.Pet.OwnerId == ownerId && !a.IsDeleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.IsDeleted, true)
                .SetProperty(a => a.DeletedAt, now));

        await db.Pets
            .IgnoreQueryFilters()
            .Where(p => p.OwnerId == ownerId && !p.IsDeleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.IsDeleted, true)
                .SetProperty(p => p.DeletedAt, now));

        await tx.CommitAsync();
        return true;
    }

    public async Task AddAllergyAsync(int petId, AllergyInput input)
    {
        var pet = await db.Pets.SingleAsync(p => p.Id == petId);
        pet.Allergies.Add(new Allergy
        {
            Allergen = input.Allergen.Trim(),
            Reaction = input.Reaction,
            Severity = input.Severity
        });
        pet.AllergiesVersion++;
        await db.SaveChangesAsync();
    }

    // Полная замена списка аллергий. expectedVersion - AllergiesVersion из карточки, по которой заполнена форма.
    // Неизменённые аллергии остаются как есть; удалённые и изменённые помечаются IsDeleted (история сохраняется),
    // новые и изменённые добавляются новыми строками.
    public async Task<ReplaceAllergiesResult> ReplaceAllergiesAsync(
        int petId, IReadOnlyList<AllergyInput> allergies, int expectedVersion)
    {
        var incoming = allergies
            .Select(a => a with { Allergen = (a.Allergen ?? "").Trim() })
            .ToList();
        if (incoming.Any(a => a.Allergen.Length == 0 || a.Allergen.Length > 200
                              || !Enum.IsDefined(a.Severity)))
            return ReplaceAllergiesResult.Invalid;

        // Один аллерген - одна запись: при повторе в форме берём последнее значение
        incoming = incoming
            .GroupBy(a => a.Allergen, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.Last())
            .ToList();

        var pet = await db.Pets
            .Include(p => p.Allergies)
            .SingleOrDefaultAsync(p => p.Id == petId);
        if (pet is null)
            return ReplaceAllergiesResult.PetNotFound;
        if (pet.AllergiesVersion != expectedVersion)
            return ReplaceAllergiesResult.Conflict;

        var now = DateTime.UtcNow;
        var kept = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var existing in pet.Allergies)
        {
            var same = incoming.Any(a =>
                string.Equals(a.Allergen, existing.Allergen, StringComparison.OrdinalIgnoreCase)
                && a.Reaction == existing.Reaction
                && a.Severity == existing.Severity);
            if (same && kept.Add(existing.Allergen))
                continue;

            existing.IsDeleted = true;
            existing.DeletedAt = now;
        }

        foreach (var input in incoming.Where(a => !kept.Contains(a.Allergen)))
        {
            pet.Allergies.Add(new Allergy
            {
                Allergen = input.Allergen,
                Reaction = input.Reaction,
                Severity = input.Severity
            });
        }

        // UPDATE Pets ... WHERE AllergiesVersion = <прочитанная>: параллельная замена получит 0 строк
        pet.AllergiesVersion++;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return ReplaceAllergiesResult.Conflict;
        }

        return ReplaceAllergiesResult.Replaced;
    }

    public async Task UpdateVisitAnamnesisAsync(int visitId, string? anamnesis)
    {
        var visit = await db.Visits.SingleAsync(v => v.Id == visitId);
        visit.Anamnesis = anamnesis;
        await db.SaveChangesAsync();
    }
}
```

### src/VetClinic.Records/Program.cs
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
    try
    {
        await s.AddAllergyAsync(id, input);
    }
    catch (DbUpdateConcurrencyException)
    {
        return Results.Conflict();
    }
    return Results.NoContent();
});

app.MapPut("/pets/{id:int}/allergies", async (int id, ReplaceAllergiesRequest request, ClinicCardService s) =>
    await s.ReplaceAllergiesAsync(id, request.Allergies, request.AllergiesVersion) switch
    {
        ReplaceAllergiesResult.Replaced => Results.NoContent(),
        ReplaceAllergiesResult.PetNotFound => Results.NotFound(),
        ReplaceAllergiesResult.Conflict => Results.Conflict(),
        _ => Results.BadRequest()
    });

app.MapPut("/visits/{id:int}/anamnesis", async (int id, string? anamnesis, ClinicCardService s) =>
{
    await s.UpdateVisitAnamnesisAsync(id, anamnesis);
    return Results.NoContent();
});

app.Run();

public record ReplaceAllergiesRequest(int AllergiesVersion, List<AllergyInput> Allergies);
```

### src/VetClinic.Records/Migrations/20261002120000_AnamnesisAllergiesVersionRestrictFks.cs
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    /// <summary>
    /// 1. Visits.Notes -> Visits.Anamnesis: RENAME COLUMN, данные остаются на месте.
    /// 2. Pets.AllergiesVersion - concurrency token списка аллергий (существующие строки получают 0).
    /// 3. FK Pets/Allergies/Visits: ON DELETE CASCADE -> RESTRICT (записи медкарты удаляются только мягко).
    /// Выкладка: идемпотентный скрипт из CI в окно обслуживания при остановленном приложении,
    /// затем deploy новой версии - старый код с новой схемой не работает.
    /// </summary>
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002120000_AnamnesisAllergiesVersionRestrictFks")]
    public partial class AnamnesisAllergiesVersionRestrictFks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Notes",
                table: "Visits",
                newName: "Anamnesis");

            migrationBuilder.AddColumn<int>(
                name: "AllergiesVersion",
                table: "Pets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.DropForeignKey(
                name: "FK_Pets_Owners_OwnerId",
                table: "Pets");

            migrationBuilder.DropForeignKey(
                name: "FK_Allergies_Pets_PetId",
                table: "Allergies");

            migrationBuilder.DropForeignKey(
                name: "FK_Visits_Pets_PetId",
                table: "Visits");

            migrationBuilder.AddForeignKey(
                name: "FK_Pets_Owners_OwnerId",
                table: "Pets",
                column: "OwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Allergies_Pets_PetId",
                table: "Allergies",
                column: "PetId",
                principalTable: "Pets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Visits_Pets_PetId",
                table: "Visits",
                column: "PetId",
                principalTable: "Pets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pets_Owners_OwnerId",
                table: "Pets");

            migrationBuilder.DropForeignKey(
                name: "FK_Allergies_Pets_PetId",
                table: "Allergies");

            migrationBuilder.DropForeignKey(
                name: "FK_Visits_Pets_PetId",
                table: "Visits");

            migrationBuilder.AddForeignKey(
                name: "FK_Pets_Owners_OwnerId",
                table: "Pets",
                column: "OwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Allergies_Pets_PetId",
                table: "Allergies",
                column: "PetId",
                principalTable: "Pets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Visits_Pets_PetId",
                table: "Visits",
                column: "PetId",
                principalTable: "Pets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.DropColumn(
                name: "AllergiesVersion",
                table: "Pets");

            migrationBuilder.RenameColumn(
                name: "Anamnesis",
                table: "Visits",
                newName: "Notes");
        }
    }
}
```

### src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs
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
                .HasAnnotation("ProductVersion", "8.0.10")
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

                    b.Property<int>("AllergiesVersion")
                        .IsConcurrencyToken()
                        .HasColumnType("integer");

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
                        .OnDelete(DeleteBehavior.Restrict)
                        .IsRequired();

                    b.Navigation("Pet");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Pet", b =>
                {
                    b.HasOne("VetClinic.Records.Domain.Owner", "Owner")
                        .WithMany("Pets")
                        .HasForeignKey("OwnerId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .IsRequired();

                    b.Navigation("Owner");
                });

            modelBuilder.Entity("VetClinic.Records.Domain.Visit", b =>
                {
                    b.HasOne("VetClinic.Records.Domain.Pet", "Pet")
                        .WithMany("Visits")
                        .HasForeignKey("PetId")
                        .OnDelete(DeleteBehavior.Restrict)
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