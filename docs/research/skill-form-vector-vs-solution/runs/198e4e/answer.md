Все три задачи сделаны. Сборку и тесты не запускал. Этот же ответ записан в `_answer.md`.

**Файлы:**
- `ReminderReportService.cs` — новый: ночной отчёт `GetSeniorRabiesRemindersAsync` (а).
- `OwnerService.cs` — изменён: поиск по телефону `FindByPhoneAsync` (б) и отказ от SMS `RevokeSmsConsentAsync` (в).
- `Domain.cs` — изменён: пороги возраста вынесены в `Pet.SeniorAgeYears`, расчёт возраста — в `Pet.CalculateAgeYears`. `IsSenior` и `AgeYears` работают как раньше.

**Решения:**
- **Отчёт.** `Pet.IsSenior` считается в памяти и не переводится в SQL. Поэтому то же правило (те же пороги) строится в запросе как «вид = X и дата рождения не позже, чем сегодня минус N лет». Весь фильтр выполняется в базе: согласие на SMS и отсутствие прививки от бешенства за последние 12 месяцев (время в UTC, работает через индекс `(PetId, VaccineCode, AdministeredAt)`). Из базы читаются только нужные поля, без отслеживания изменений.
- **Поиск по телефону.** Номер не уникален (на один телефон записана семья), поэтому метод возвращает всех владельцев с этим номером и их питомцев, а регистратор выбирает нужного. Номер в любом формате приводится к одному виду через `PhoneFormat.Normalize`; на некорректный номер будет `ArgumentException`. Возраст считается в памяти по дате рождения.
- **Отказ от SMS.** Это один `UPDATE` с условием «согласие ещё есть», время пишется в UTC. Повторный или одновременный звонок не перезапишет время первого отказа. Если владельца с таким Id нет, будет `KeyNotFoundException`.

### ReminderReportService.cs (новый)
```csharp
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Ночной отчёт для SMS-рассылки по программе для возрастных питомцев:
    // возрастной питомец, прививки от бешенства не было или последняя старше 12 месяцев,
    // владелец дал согласие на SMS. Весь фильтр выполняется в SQL, читается только проекция.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);   // timestamptz -> Kind=Utc

        return await db.Pets
            .Where(SeniorPredicate(DateOnly.FromDateTime(DateTime.Today)))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .OrderBy(p => p.OwnerId).ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // Pet.IsSenior вычисляется в памяти и в SQL не транслируется. Здесь то же правило
    // из Pet.SeniorAgeYears: AgeYears >= N  <=>  BirthDate <= today.AddYears(-N).
    // Получается (Species = Dog AND BirthDate <= ...) OR (Species = Cat AND ...) OR ...
    private static Expression<Func<Pet, bool>> SeniorPredicate(DateOnly today)
    {
        var p = Expression.Parameter(typeof(Pet), "p");
        Expression? body = null;

        foreach (var (species, seniorAge) in Pet.SeniorAgeYears)
        {
            var term = Expression.AndAlso(
                Expression.Equal(
                    Expression.Property(p, nameof(Pet.Species)),
                    Expression.Constant(species)),
                Expression.LessThanOrEqual(
                    Expression.Property(p, nameof(Pet.BirthDate)),
                    Expression.Constant(today.AddYears(-seniorAge))));
            body = body is null ? term : Expression.OrElse(body, term);
        }

        return Expression.Lambda<Func<Pet, bool>>(body ?? Expression.Constant(false), p);
    }
}
```

### OwnerService.cs (изменён)
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record PetSummary(int Id, string Name, Species Species, int AgeYears);

public record OwnerWithPets(int Id, string FullName, string Phone, string? Email, IReadOnlyList<PetSummary> Pets);

public class OwnerService(ClinicDbContext db)
{
    public async Task<Owner?> FindByEmailAsync(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await db.Owners
            .Include(o => o.Pets)
            .SingleOrDefaultAsync(o => o.Email == normalized);
    }

    // Номер не уникален (на один телефон записана семья), поэтому возвращается список владельцев,
    // а не Single: регистратор сам выбирает нужного. Некорректный номер - ArgumentException из PhoneFormat.
    public async Task<List<OwnerWithPets>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);

        var owners = await db.Owners
            .Where(o => o.Phone == normalized)
            .OrderBy(o => o.FullName)
            .Select(o => new
            {
                o.Id,
                o.FullName,
                o.Phone,
                o.Email,
                Pets = o.Pets
                    .OrderBy(p => p.Name)
                    .Select(p => new { p.Id, p.Name, p.Species, p.BirthDate })
                    .ToList()
            })
            .ToListAsync();

        // Возраст считается в памяти из BirthDate - это отображение, не фильтр.
        return owners
            .Select(o => new OwnerWithPets(
                o.Id, o.FullName, o.Phone, o.Email,
                o.Pets.Select(p => new PetSummary(p.Id, p.Name, p.Species, Pet.CalculateAgeYears(p.BirthDate))).ToList()))
            .ToList();
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

    // Отказ от SMS. Один атомарный UPDATE с условием SmsConsent = true: повторный или параллельный
    // вызов не перезапишет момент первого отказа. Если владельца нет - KeyNotFoundException.
    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var now = DateTime.UtcNow;   // timestamptz -> Kind=Utc

        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                .SetProperty(o => o.SmsConsentChangedAt, now));

        if (updated == 0 && !await db.Owners.AnyAsync(o => o.Id == ownerId))
            throw new KeyNotFoundException($"Владелец {ownerId} не найден");
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

### Domain.cs (изменён)
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

    public int AgeYears => CalculateAgeYears(BirthDate);

    // Вынесено в статический метод, чтобы считать возраст по BirthDate из проекции без загрузки сущности.
    public static int CalculateAgeYears(DateOnly birthDate)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var age = today.Year - birthDate.Year;
        if (birthDate > today.AddYears(-age))
            age--;
        return age;
    }

    // Правило клиники: с какого возраста питомец считается возрастным
    // (для возрастных действует своя программа напоминаний).
    // Тот же словарь использует ReminderReportService для фильтра в SQL - правило в одном месте.
    public static readonly IReadOnlyDictionary<Species, int> SeniorAgeYears = new Dictionary<Species, int>
    {
        [Species.Dog] = 8,
        [Species.Cat] = 10,
        [Species.Ferret] = 5,
        [Species.Rabbit] = 6
    };

    public bool IsSenior => SeniorAgeYears.TryGetValue(Species, out var seniorAge) && AgeYears >= seniorAge;
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