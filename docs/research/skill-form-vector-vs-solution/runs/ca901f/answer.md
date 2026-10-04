Сделал все три задачи. Сборку и тесты не запускал, как вы и просили. Этот же ответ записан в `_answer.md`.

## Созданные и изменённые файлы
- `ReminderReportService.cs` — **новый**, задача (а).
- `OwnerService.cs` — **изменён**, задачи (б) и (в).
- `Domain.cs` — **изменён**: возрастные пороги вынесены в `Pet.SeniorAgeYears`, само правило не поменялось.

## Решения
- **(а)** `Pet.IsSenior` вычисляется в C#, и EF Core не может перевести его в SQL. Если фильтровать по нему, придётся загрузить в память все 250 тыс. питомцев. Поэтому правило переведено в SQL-условие `(Species = X AND BirthDate <= today − N лет) OR …`. Пороги берутся из того же `Pet.SeniorAgeYears`, что и в `IsSenior`, так что правило задано в одном месте. Проверка прививки идёт через `NOT EXISTS` по уже существующему индексу `(PetId, VaccineCode, AdministeredAt)`. Граница «12 месяцев» считается в UTC, потому что Npgsql хранит это поле как `timestamptz`.
- **(б)** Один номер может принадлежать нескольким людям (на одном телефоне часто записана вся семья), поэтому метод возвращает **список** владельцев с питомцами. Номер сначала приводится к единому виду через `PhoneFormat.Normalize`. Если номер некорректный, будет `ArgumentException`, как и при создании владельца.
- **(в)** Если согласия на SMS уже нет, метод ничего не меняет и не перезаписывает время прошлого изменения. Время записывается в UTC.

## ReminderReportService.cs (новый)
```csharp
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Возрастные питомцы без прививки от бешенства за последние 12 месяцев, владелец согласен на SMS.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        // Те же "сегодня", что и в Pet.AgeYears; AdministeredAt хранится в timestamptz - граница в UTC.
        var today = DateOnly.FromDateTime(DateTime.Today);
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .AsNoTracking()
            .Where(SeniorOn(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .OrderBy(p => p.OwnerId).ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // Переводит правило Pet.IsSenior в SQL-условие:
    // AgeYears >= N  <=>  BirthDate <= today.AddYears(-N)  (та же арифметика, что в Pet.AgeYears).
    // Получается (Species = Dog AND BirthDate <= @d1) OR (Species = Cat AND BirthDate <= @d2) OR ...
    private static Expression<Func<Pet, bool>> SeniorOn(DateOnly today)
    {
        var pet = Expression.Parameter(typeof(Pet), "p");
        Expression body = Expression.Constant(false);

        foreach (var (species, seniorAge) in Pet.SeniorAgeYears)
        {
            var bornOnOrBefore = today.AddYears(-seniorAge);
            var condition = Expression.AndAlso(
                Expression.Equal(Expression.Property(pet, nameof(Pet.Species)), Expression.Constant(species)),
                Expression.LessThanOrEqual(Expression.Property(pet, nameof(Pet.BirthDate)), Expression.Constant(bornOnOrBefore)));
            body = Expression.OrElse(body, condition);
        }

        return Expression.Lambda<Func<Pet, bool>>(body, pet);
    }
}
```

## OwnerService.cs (изменён)
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public class OwnerService(ClinicDbContext db)
{
    public async Task<Owner?> FindByEmailAsync(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await db.Owners
            .Include(o => o.Pets)
            .SingleOrDefaultAsync(o => o.Email == normalized);
    }

    // Телефон не уникален (семья на одном номере), поэтому возвращается список владельцев.
    // Некорректный номер -> ArgumentException из PhoneFormat.Normalize.
    public async Task<List<Owner>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);
        return await db.Owners
            .AsNoTracking()
            .Include(o => o.Pets.OrderBy(p => p.Name))
            .Where(o => o.Phone == normalized)
            .OrderBy(o => o.FullName)
            .ToListAsync();
    }

    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var owner = await db.Owners.SingleAsync(o => o.Id == ownerId);
        if (!owner.SmsConsent)
            return;   // согласия уже нет - момент прошлого изменения не перезаписываем

        owner.SmsConsent = false;
        owner.SmsConsentChangedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<Owner> CreateAsync(string fullName, string phone, string? email, bool smsConsent)
    {
        var owner = new Owner
        {
            FullName = fullName.Trim(),
            Phone = PhoneFormat.Normalize(phone),
            Email = email?.Trim().ToLowerInvariant(),
            SmsConsent = smsConsent
        };
        db.Owners.Add(owner);
        await db.SaveChangesAsync();
        return owner;
    }

    public async Task UpdateContactsAsync(int ownerId, string phone, string? email)
    {
        var owner = await db.Owners.SingleAsync(o => o.Id == ownerId);
        owner.Phone = PhoneFormat.Normalize(phone);
        owner.Email = email?.Trim().ToLowerInvariant();
        await db.SaveChangesAsync();
    }
}

public static class PhoneFormat
{
    // "+7 (912) 345-67-89", "8 912 345 67 89", "9123456789" -> "79123456789"
    public static string Normalize(string raw)
    {
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 10)
            digits = "7" + digits;
        if (digits.Length == 11 && digits[0] == '8')
            digits = "7" + digits[1..];
        if (digits.Length != 11 || digits[0] != '7')
            throw new ArgumentException($"Некорректный номер телефона: {raw}", nameof(raw));
        return digits;
    }
}
```

## Domain.cs (изменён)
```csharp
namespace VetClinic.Reception.Domain;

public enum Species
{
    Dog = 1,
    Cat = 2,
    Ferret = 3,
    Rabbit = 4,
    Other = 99
}

public class Owner
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";

    // Только цифры, 11 знаков, начинается с 7 - приводится PhoneFormat.Normalize при сохранении.
    // Номер не уникален: на один телефон часто записаны несколько членов семьи.
    public string Phone { get; set; } = "";

    public string? Email { get; set; }

    public bool SmsConsent { get; set; }
    public DateTime? SmsConsentChangedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<Pet> Pets { get; set; } = new();
}

public class Pet
{
    public int Id { get; set; }
    public int OwnerId { get; set; }
    public Owner Owner { get; set; } = null!;

    public string Name { get; set; } = "";
    public Species Species { get; set; }
    public DateOnly BirthDate { get; set; }

    public List<Vaccination> Vaccinations { get; set; } = new();

    public int AgeYears
    {
        get
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var age = today.Year - BirthDate.Year;
            if (BirthDate > today.AddYears(-age))
                age--;
            return age;
        }
    }

    // Правило клиники: с какого возраста питомец считается возрастным
    // (для возрастных действует своя программа напоминаний).
    public bool IsSenior => SeniorAgeYears.TryGetValue(Species, out var seniorAge) && AgeYears >= seniorAge;

    // Единственный источник правила: используется и в IsSenior, и в SQL-фильтре отчётов
    // (IsSenior вычисляется в памяти и не транслируется EF Core в SQL).
    public static readonly IReadOnlyDictionary<Species, int> SeniorAgeYears = new Dictionary<Species, int>
    {
        [Species.Dog] = 8,
        [Species.Cat] = 10,
        [Species.Ferret] = 5,
        [Species.Rabbit] = 6
    };
}

public class Vaccination
{
    public int Id { get; set; }
    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string VaccineCode { get; set; } = "";   // см. VaccineCodes
    public DateTime AdministeredAt { get; set; }
}

public static class VaccineCodes
{
    public const string Rabies = "RABIES";
    public const string Complex = "COMPLEX";
}
```