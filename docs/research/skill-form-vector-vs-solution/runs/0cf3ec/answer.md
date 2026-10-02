Все три доработки сделаны. Сборку и тесты я не запускал, как ты и просил. Тот же итог записан в `_answer.md`.

**Изменённые файлы**
- `src/VetClinic.Records/Domain.cs`: поле `Notes` в `Visit` переименовано в `Anamnesis`.
- `src/VetClinic.Records/ClinicDbContext.cs`: у связей «питомец → клиент», «аллергия → питомец» и «визит → питомец» теперь `OnDelete(Restrict)` вместо каскадного удаления.
- `src/VetClinic.Records/ClinicCardService.cs`: добавлены `DeleteOwnerAsync` и `ReplaceAllergiesAsync`, в `VisitDto` поле стало `Anamnesis`, метод `UpdateVisitNotesAsync` стал `UpdateVisitAnamnesisAsync`.
- `src/VetClinic.Records/Program.cs`: добавлены `DELETE /owners/{id}` и `PUT /pets/{id}/allergies`, маршрут `/visits/{id}/notes` стал `/visits/{id}/anamnesis`.

**Новые файлы** (миграции написаны вручную)
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs`
- `src/VetClinic.Records/Migrations/20261002090100_RestrictDeleteOnMedicalRecordFks.cs`
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`

**Решения**
- **(а) Удаление клиента.** По README записи физически не удаляются, поэтому удаление мягкое. В одной транзакции помечаются удалёнными клиент, его питомцы, все их визиты и аллергии, у всех одинаковое время удаления — так поддержка сможет восстановить их вместе. Визиты приходится помечать отдельно: фильтр визитов не проверяет, удалён ли питомец, и без этого визиты удалённого клиента остались бы в расписании врача. Каскадное удаление в БД я заменил на запрет (это вторая миграция): так случайный `DELETE` клиента не сотрёт историю, которую надо хранить 5 лет.
- **(б) Аллергии.** Совпадающие записи остаются как есть, лишние помечаются удалёнными, недостающие добавляются. Строка питомца блокируется на время сохранения, чтобы две одновременные отправки формы не создали дубли. Пустой аллерген или повтор в списке дают ответ 400.
- **(в) Анамнез.** Колонка переименовывается (`RENAME COLUMN`), а не удаляется и создаётся заново, так что старые заметки сохраняются. Выкладка идёт по текущему пайплайну без изменений: идемпотентный SQL-скрипт, ревью DBA, `db-migrate` при остановленном приложении, затем `deploy`.

**До выкладки нужно решить**
- **В репозитории не было папки `Migrations`.** Я написал только две новые миграции и снимок модели. Проверьте в прод-БД реальные имена внешних ключей (я взял стандартные имена EF, например `FK_Pets_Owners_OwnerId`) и наличие таблицы `__EFMigrationsHistory`. Создать БД с нуля из этих миграций нельзя.
- **API меняется несовместимо.** В ответах поле `Notes` стало `Anamnesis`, маршрут тоже переименован, поэтому фронтенд нужно выкладывать одновременно с сервисом.
- **Миграция с запретом каскадного удаления — моё дополнение, в задаче его не было.** Если сейчас она не нужна, её можно убрать вместе с правкой в `ClinicDbContext.cs` и снимке модели.

---

### Domain.cs
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

### ClinicDbContext.cs
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
        // Записи медкарты физически не удаляются (soft-delete), поэтому FK без каскада:
        // случайный DELETE родителя не должен уносить историю, которую обязаны хранить 5 лет.
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

### ClinicCardService.cs
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

    // Список аллергий целиком заменяется присланным. Физически ничего не удаляется:
    // совпадающие записи остаются как есть, остальные помечаются удалёнными, недостающие добавляются.
    public async Task<bool> ReplaceAllergiesAsync(int petId, IReadOnlyList<AllergyInput> allergies)
    {
        var wanted = allergies
            .Select(a => new AllergyInput(
                a.Allergen?.Trim() ?? "",
                string.IsNullOrWhiteSpace(a.Reaction) ? null : a.Reaction.Trim(),
                a.Severity))
            .ToList();
        if (wanted.Any(a => a.Allergen.Length == 0))
            throw new ArgumentException("Аллерген не может быть пустым.");
        if (wanted.Any(a => !Enum.IsDefined(a.Severity)))
            throw new ArgumentException("Неизвестная степень тяжести аллергии.");
        var duplicate = wanted
            .GroupBy(a => a.Allergen, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            throw new ArgumentException($"Аллерген «{duplicate.Key}» указан в списке несколько раз.");

        await using var tx = await db.Database.BeginTransactionAsync();

        // Блокировка строки питомца сериализует параллельные сохранения формы:
        // иначе два запроса прочитают один и тот же список и оба добавят недостающие записи.
        var petExists = await db.Pets
            .FromSql($"""SELECT * FROM "Pets" WHERE "Id" = {petId} AND NOT "IsDeleted" FOR UPDATE""")
            .IgnoreQueryFilters()
            .AnyAsync();
        if (!petExists)
            return false;

        var current = await db.Allergies.Where(a => a.PetId == petId).ToListAsync();

        var now = DateTime.UtcNow;
        var toAdd = new List<AllergyInput>(wanted);
        foreach (var allergy in current)
        {
            var same = toAdd.FindIndex(w =>
                w.Allergen == allergy.Allergen && w.Reaction == allergy.Reaction && w.Severity == allergy.Severity);
            if (same >= 0)
            {
                toAdd.RemoveAt(same);
            }
            else
            {
                allergy.IsDeleted = true;
                allergy.DeletedAt = now;
            }
        }

        db.Allergies.AddRange(toAdd.Select(w => new Allergy
        {
            PetId = petId,
            Allergen = w.Allergen,
            Reaction = w.Reaction,
            Severity = w.Severity
        }));

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return true;
    }

    // Удаление клиента = soft-delete клиента и всей его медкарты одной транзакцией с общим DeletedAt
    // (по нему поддержка восстанавливает удалённое вместе). Зависимые помечаются явно: фильтр Visit
    // не смотрит на питомца, и без этого визиты удалённого клиента остались бы в расписании врача.
    public async Task<bool> DeleteOwnerAsync(int ownerId)
    {
        var now = DateTime.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync();

        var deletedOwners = await db.Owners
            .Where(o => o.Id == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.IsDeleted, true)
                .SetProperty(o => o.DeletedAt, now));
        if (deletedOwners == 0)
            return false;

        // IgnoreQueryFilters + явный !IsDeleted: ранее удалённые записи сохраняют свой DeletedAt,
        // а соединение с Pets не зависит от того, помечены ли питомцы к этому моменту.
        await db.Visits
            .IgnoreQueryFilters()
            .Where(v => !v.IsDeleted && v.Pet.OwnerId == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.IsDeleted, true)
                .SetProperty(v => v.DeletedAt, now));

        await db.Allergies
            .IgnoreQueryFilters()
            .Where(a => !a.IsDeleted && a.Pet.OwnerId == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.IsDeleted, true)
                .SetProperty(a => a.DeletedAt, now));

        await db.Pets
            .IgnoreQueryFilters()
            .Where(p => !p.IsDeleted && p.OwnerId == ownerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.IsDeleted, true)
                .SetProperty(p => p.DeletedAt, now));

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

### Program.cs
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

app.MapPut("/pets/{id:int}/allergies", async (int id, List<AllergyInput> allergies, ClinicCardService s) =>
{
    try
    {
        return await s.ReplaceAllergiesAsync(id, allergies) ? Results.NoContent() : Results.NotFound();
    }
    catch (ArgumentException ex)
    {
        return Results.Problem(ex.Message, statusCode: StatusCodes.Status400BadRequest);
    }
});

app.MapDelete("/owners/{id:int}", async (int id, ClinicCardService s) =>
    await s.DeleteOwnerAsync(id) ? Results.NoContent() : Results.NotFound());

app.MapPut("/visits/{id:int}/anamnesis", async (int id, string? anamnesis, ClinicCardService s) =>
{
    await s.UpdateVisitAnamnesisAsync(id, anamnesis);
    return Results.NoContent();
});

app.Run();
```

### Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    /// <summary>
    /// Visit.Notes -> Visit.Anamnesis. Переименование колонки (ALTER TABLE ... RENAME COLUMN),
    /// а не drop + add: существующие заметки визитов сохраняются.
    /// </summary>
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002090000_RenameVisitNotesToAnamnesis")]
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

### Migrations/20261002090100_RestrictDeleteOnMedicalRecordFks.cs
```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using VetClinic.Records.Data;

#nullable disable

namespace VetClinic.Records.Migrations
{
    /// <summary>
    /// FK зависимых записей медкарты: CASCADE -> RESTRICT. Записи удаляются только мягко,
    /// физический DELETE клиента/питомца не должен каскадно стирать историю.
    /// </summary>
    [DbContext(typeof(ClinicDbContext))]
    [Migration("20261002090100_RestrictDeleteOnMedicalRecordFks")]
    public partial class RestrictDeleteOnMedicalRecordFks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Pets_Owners_OwnerId", table: "Pets");
            migrationBuilder.DropForeignKey(name: "FK_Allergies_Pets_PetId", table: "Allergies");
            migrationBuilder.DropForeignKey(name: "FK_Visits_Pets_PetId", table: "Visits");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Pets_Owners_OwnerId", table: "Pets");
            migrationBuilder.DropForeignKey(name: "FK_Allergies_Pets_PetId", table: "Allergies");
            migrationBuilder.DropForeignKey(name: "FK_Visits_Pets_PetId", table: "Visits");

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

### Migrations/ClinicDbContextModelSnapshot.cs
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