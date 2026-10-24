Все три задачи сделаны. Сборку и тесты, как и просили, не запускал. Тот же ответ записан в `_answer.md`.

## Файлы
- `ReminderReportService.cs`: **новый**, ночной отчёт (а).
- `OwnerService.cs`: **изменён**, добавлены `FindByPhoneAsync` (б) и `RevokeSmsConsentAsync` (в).
- `Domain.cs`: **изменён**, возрастные пороги из `Pet.IsSenior` вынесены в `Pet.SeniorAgeYears`. Поведение `IsSenior` не изменилось.
- `ClinicDbContext.cs`: без изменений.

## Решения
- **(а)** `Pet.IsSenior` считается в памяти, в SQL его перевести нельзя, а грузить 250 тыс. питомцев и 1,5 млн прививок в память не вариант. Поэтому правило переписано как условие по виду и дате рождения: `AgeYears >= N` равносильно `BirthDate <= today.AddYears(-N)`. Пороги берутся из того же `Pet.SeniorAgeYears`, так что правило записано в одном месте. Отсутствие прививки за 12 месяцев проверяется через `NOT EXISTS` по существующему индексу. Весь запрос выполняется в БД и читает только нужные поля.
- **(б)** Один номер может быть у нескольких членов семьи, поэтому метод возвращает список владельцев с питомцами. Номер в любом формате приводится через `PhoneFormat.Normalize`. На некорректный номер выбрасывается `ArgumentException`, как в `CreateAsync`.
- **(в)** `SmsConsentChangedAt` (UTC) записывается, только если согласие действительно было. Повторный звонок не затрёт дату первого отказа.

### ReminderReportService.cs
```csharp
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Ночной отчёт для SMS-программы возрастных питомцев: возрастной питомец (Pet.IsSenior),
    // прививки от бешенства не было за последние 12 месяцев (или не было вовсе), владелец согласен на SMS.
    // Вся фильтрация выполняется в БД: Pet.IsSenior вычисляется в памяти и в SQL не транслируется,
    // поэтому правило переводится в условия по дате рождения (см. SeniorPredicate).
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .AsNoTracking()
            .Where(SeniorPredicate(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .OrderBy(p => p.Owner.FullName)
            .ThenBy(p => p.Name)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // Pet.AgeYears >= N  <=>  BirthDate <= today.AddYears(-N) - та же арифметика, что в Pet.AgeYears
    // (включая 29 февраля). Строит: (Species == Dog && BirthDate <= ...) || (Species == Cat && ...) || ...
    // Это же условие использует индекс (Species, BirthDate).
    private static Expression<Func<Pet, bool>> SeniorPredicate(DateOnly today)
    {
        var pet = Expression.Parameter(typeof(Pet), "p");
        Expression body = Expression.Constant(false);

        foreach (var (species, minAge) in Pet.SeniorAgeYears)
        {
            var condition = Expression.AndAlso(
                Expression.Equal(
                    Expression.Property(pet, nameof(Pet.Species)),
                    Expression.Constant(species)),
                Expression.LessThanOrEqual(
                    Expression.Property(pet, nameof(Pet.BirthDate)),
                    Expression.Constant(today.AddYears(-minAge))));

            body = Expression.OrElse(body, condition);
        }

        return Expression.Lambda<Func<Pet, bool>>(body, pet);
    }
}
```

### OwnerService.cs
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

    // Номер не уникален (семья на одном телефоне), поэтому возвращается список.
    // Некорректный номер - ArgumentException из PhoneFormat.Normalize, экран показывает ошибку ввода.
    public async Task<List<OwnerSearchResult>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);
        var owners = await db.Owners
            .AsNoTracking()
            .Include(o => o.Pets)
            .Where(o => o.Phone == normalized)
            .OrderBy(o => o.FullName)
            .ToListAsync();

        return owners
            .Select(o => new OwnerSearchResult(
                o.Id,
                o.FullName,
                o.Phone,
                o.Email,
                o.Pets
                    .OrderBy(p => p.Name)
                    .Select(p => new PetSummary(p.Id, p.Name, p.Species, p.AgeYears))
                    .ToList()))
            .ToList();
    }

    // Отказ клиента от SMS. Момент фиксируется только при реальном изменении согласия,
    // повторный звонок не перезаписывает дату первоначального отказа.
    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var owner = await db.Owners.SingleAsync(o => o.Id == ownerId);
        if (!owner.SmsConsent)
            return;

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

public record PetSummary(int Id, string Name, Species Species, int AgeYears);

public record OwnerSearchResult(int Id, string FullName, string Phone, string? Email, List<PetSummary> Pets);

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

### Domain.cs
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
    // Видов, которых нет в словаре, правило не касается.
    // Используется и в SQL-запросах (ReminderReportService), поэтому правило живёт здесь в одном месте.
    public static readonly IReadOnlyDictionary<Species, int> SeniorAgeYears = new Dictionary<Species, int>
    {
        [Species.Dog] = 8,
        [Species.Cat] = 10,
        [Species.Ferret] = 5,
        [Species.Rabbit] = 6
    };

    public bool IsSenior => SeniorAgeYears.TryGetValue(Species, out var minAge) && AgeYears >= minAge;
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