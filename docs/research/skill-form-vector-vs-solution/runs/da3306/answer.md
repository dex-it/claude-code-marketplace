Сделал все три доработки и вручную написал миграции. Сборку и тесты я не запускал, как и было условлено, поэтому код не проверен компилятором. Тот же ответ записан в `_answer.md`.

## Изменённые и созданные файлы

Изменены:
- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` переименовано в `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicDbContext.cs` — у внешних ключей Pet→Owner, Allergy→Pet и Visit→Pet теперь `OnDelete(DeleteBehavior.Restrict)`.
- `src/VetClinic.Records/ClinicCardService.cs` — новые методы `DeleteOwnerAsync` и `ReplaceAllergiesAsync`; `VisitDto.Notes` стало `Anamnesis`; `UpdateVisitNotesAsync` стало `UpdateVisitAnamnesisAsync`.
- `src/VetClinic.Records/Program.cs` — новые эндпоинты `DELETE /owners/{id}` и `PUT /pets/{id}/allergies`; `PUT /visits/{id}/notes` заменён на `PUT /visits/{id}/anamnesis`.

Созданы (каталога `Migrations` в репозитории не было):
- `src/VetClinic.Records/Migrations/20261002090000_SoftDeleteRestrictFks.cs`
- `src/VetClinic.Records/Migrations/20261002090100_RenameVisitNotesToAnamnesis.cs`
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`

## Решения

- **(а) Удаление клиента.** По README данные медкарт физически не удаляются, поэтому удаление мягкое. Метод одной транзакцией ставит `IsDeleted` и `DeletedAt` (в UTC) клиенту, его активным питомцам, их аллергиям и всем визитам. Обновление сделано массово через `ExecuteUpdate`. Поэтому клиент, питомцы и визиты пропадают из всех списков, карточек и расписаний врачей. Каскадное удаление (`ON DELETE CASCADE`) на внешних ключах заменено на `Restrict`, чтобы случайный физический `DELETE` не стёр историю.
- **(б) Аллергии.** Список синхронизируется по названию аллергена (без учёта регистра): совпавшие записи обновляются, лишние мягко удаляются, новые добавляются. Пустой или повторяющийся аллерген даёт ответ 400. На время транзакции строка питомца блокируется (`FOR UPDATE`), поэтому параллельные сохранения формы не перетирают друг друга молча.
- **(в) Переименование.** В миграции используется `RenameColumn`, поэтому старые заметки сохраняются. Выкладка идёт обычным порядком из `.gitlab-ci.yml`: идемпотентный SQL-скрипт → DBA → `db-migrate` в окно обслуживания при остановленном приложении → `deploy`. Поле переименовано и в API (`anamnesis`, новый маршрут), значит фронтенд нужно выкатывать вместе с сервисом.

**Что проверить перед выкладкой:**
- Имена внешних ключей в миграции я взял по соглашению EF (`FK_Pets_Owners_OwnerId` и т. п.). Их нужно сверить с продовой базой и посмотреть `migrate.sql`.
- В репозитории нет исходной миграции схемы и `.csproj`. Если снимок модели где-то уже есть, его надо объединить с моим.

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

### `src/VetClinic.Records/ClinicDbContext.cs`
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
        // Записи медкарты физически не удаляются (см. README): каскадного удаления в БД нет,
        // «удаление» - это IsDeleted/DeletedAt, проставляемые сервисом.
        b.Entity<Owner>(e =>
        {
            e.HasQueryFilter(o => !o.IsDeleted);
            e.Property(o => o.FullName).HasMaxLength(200);
            e.Property(o => o.Phone).HasMaxLength(11);
        });

        b.Entity<Pet>(e =>
        {
            e.HasQueryFilter(p => !p.IsDeleted);
            e.Property(p => p.Name).HasMaxLength(100);
            e.HasOne(p => p.Owner).WithMany(o => o.Pets).HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Allergy>(e =>
        {
            e.HasQueryFilter(a => !a.IsDeleted);
            e.Property(a => a.Allergen).HasMaxLength(200);
            e.HasOne(a => a.Pet).WithMany(p => p.Allergies).HasForeignKey(a => a.PetId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Visit>(e =>
        {
            e.HasQueryFilter(v => !v.IsDeleted);
            e.Property(v => v.VetName).HasMaxLength(200);
            e.HasOne(v => v.Pet).WithMany(p => p.Visits).HasForeignKey(v => v.PetId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(v => new { v.VetName, v.Status, v.ScheduledAt });
        });
    }
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

    // Мягкое удаление клиента вместе с питомцами, их аллергиями и визитами (физически строки
    // остаются - требование ветнадзора). Всё одной транзакцией: либо скрыто всё, либо ничего.
    // Возвращает false, если клиента нет или он уже удалён.
    public async Task<bool> DeleteOwnerAsync(int ownerId)
    {
        DateTime? deletedAt = DateTime.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync();

        var owners = await db.Owners
            .Where(o => o.Id == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.IsDeleted, true)
                .SetProperty(o => o.DeletedAt, deletedAt));
        if (owners == 0)
            return false;

        // Только питомцы, активные на момент удаления клиента: удалённые раньше сохраняют свой DeletedAt.
        var petIds = await db.Pets
            .Where(p => p.OwnerId == ownerId)
            .Select(p => p.Id)
            .ToListAsync();

        // Сначала строки питомцев - в том же порядке блокировок, что и ReplaceAllergiesAsync.
        await db.Pets
            .Where(p => petIds.Contains(p.Id))
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.IsDeleted, true)
                .SetProperty(p => p.DeletedAt, deletedAt));

        await db.Allergies
            .Where(a => petIds.Contains(a.PetId))
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.IsDeleted, true)
                .SetProperty(a => a.DeletedAt, deletedAt));

        // Все визиты, включая запланированные: они пропадают из карточек и расписания врачей.
        await db.Visits
            .Where(v => petIds.Contains(v.PetId))
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.IsDeleted, true)
                .SetProperty(v => v.DeletedAt, deletedAt));

        await tx.CommitAsync();
        return true;
    }

    // Полная замена списка аллергий питомца. Совпадающие по аллергену записи обновляются,
    // отсутствующие в новом списке - мягко удаляются, новые - добавляются.
    // Возвращает false, если питомца нет или он удалён.
    public async Task<bool> ReplaceAllergiesAsync(int petId, IReadOnlyList<AllergyInput> allergies)
    {
        var wanted = new Dictionary<string, AllergyInput>(StringComparer.OrdinalIgnoreCase);
        foreach (var input in allergies)
        {
            var allergen = input.Allergen?.Trim();
            if (string.IsNullOrEmpty(allergen))
                throw new ArgumentException("Аллерген не может быть пустым.", nameof(allergies));
            if (!wanted.TryAdd(allergen, input with { Allergen = allergen }))
                throw new ArgumentException($"Аллерген «{allergen}» указан дважды.", nameof(allergies));
        }

        await using var tx = await db.Database.BeginTransactionAsync();

        // Блокируем строку питомца до Commit: параллельные замены списка (и удаление клиента)
        // выполняются последовательно, а не перетирают друг друга.
        var petExists = await db.Pets
            .FromSql($"""SELECT * FROM "Pets" WHERE "Id" = {petId} FOR UPDATE""")
            .AnyAsync();
        if (!petExists)
            return false;

        var current = await db.Allergies
            .Where(a => a.PetId == petId)
            .ToListAsync();

        var deletedAt = DateTime.UtcNow;
        foreach (var allergy in current)
        {
            if (wanted.Remove(allergy.Allergen, out var input))
            {
                allergy.Allergen = input.Allergen;
                allergy.Reaction = input.Reaction;
                allergy.Severity = input.Severity;
            }
            else
            {
                allergy.IsDeleted = true;
                allergy.DeletedAt = deletedAt;
            }
        }

        foreach (var input in wanted.Values)
        {
            db.Allergies.Add(new Allergy
            {
                PetId = petId,
                Allergen = input.Allergen,
                Reaction = input.Reaction,
                Severity = input.Severity
            });
        }

        await db.SaveChangesAsync();
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
        return Results.BadRequest(e.Message);
    }
});

app.MapPut("/visits/{id:int}/anamnesis", async (int id, string? anamnesis, ClinicCardService s) =>
{
    await s.UpdateVisitAnamnesisAsync(id, anamnesis);
    return Results.NoContent();
});

app.Run();
```

### `src/VetClinic.Records/Migrations/20261002090000_SoftDeleteRestrictFks.cs`
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    /// <summary>
    /// Записи медкарты удаляются только мягко: убираем ON DELETE CASCADE с FK,
    /// чтобы случайный физический DELETE клиента/питомца не стирал историю.
    /// </summary>
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002090000_SoftDeleteRestrictFks")]
    public partial class SoftDeleteRestrictFks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
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
        }
    }
}
```

### `src/VetClinic.Records/Migrations/20261002090100_RenameVisitNotesToAnamnesis.cs`
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    /// <summary>
    /// Visits.Notes -> Visits.Anamnesis. Именно RENAME COLUMN, а не drop/add:
    /// существующие заметки сохраняются и сразу видны новому коду.
    /// Выкладка - в окно обслуживания (приложение остановлено), т.к. старый код читает "Notes".
    /// </summary>
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002090100_RenameVisitNotesToAnamnesis")]
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