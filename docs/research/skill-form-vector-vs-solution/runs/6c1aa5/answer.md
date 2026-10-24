Сделал все три задачи. Сборку и тесты не запускал, как и договаривались. Ответ записан в `_answer.md`.

**Новые и изменённые файлы:**
- `ReminderReportService.cs` — новый: метод отчёта `GetSeniorRabiesRemindersAsync` и строка отчёта `SeniorRabiesReminderRow`.
- `OwnerService.cs` — изменён: добавлены `FindByPhoneAsync` (с типами результата `OwnerLookupResult` и `PetSummary`) и `RevokeSmsConsentAsync`.
- `Domain.cs` — изменён: пороги возраста вынесены в `Pet.SeniorAgeYears(Species)`, расчёт возраста — в `Pet.AgeOn(...)`. `IsSenior` и `AgeYears` работают как раньше, просто теперь используют эти методы.

**Решения:**
- **(а)** `IsSenior` вычисляется в C#, и EF не может перевести его в SQL. Поэтому правило переписано как условие на дату рождения: `BirthDate <= сегодня − N лет` для каждого вида, где N берётся из `SeniorAgeYears`. Отсутствие прививки за 12 месяцев проверяется подзапросом `NOT EXISTS`. Граница считается от `DateTime.UtcNow`, потому что колонка хранит время с часовым поясом (`timestamptz`), а другое время Npgsql записать не даст. Все фильтры выполняются в базе, и запрос забирает только четыре нужных поля, так что 250 тыс. питомцев и 1,5 млн прививок в память не загружаются.
- **(б)** Введённый номер приводится к общему виду через `PhoneFormat.Normalize`. На один телефон может быть записано несколько членов семьи, поэтому метод возвращает список всех таких владельцев с их питомцами. Если номер некорректный, выбрасывается `ArgumentException`.
- **(в)** Согласие снимается одним запросом `ExecuteUpdate` с условием `WHERE Id = @id AND SmsConsent`. Так одновременные правки других полей владельца не затираются, а повторный отказ не сдвигает время в `SmsConsentChangedAt`. Если владельца с таким Id нет, выбрасывается `InvalidOperationException`.

### ReminderReportService.cs (новый)
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Возрастные питомцы без прививки от бешенства за последние 12 месяцев,
    // владелец которых согласен на SMS.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        // Pet.IsSenior - вычисляемое свойство, в SQL не транслируется. Правило переводится в
        // эквивалентное условие по BirthDate: AgeYears >= N  <=>  BirthDate <= today - N лет.
        // Пороги берутся из Pet.SeniorAgeYears, чтобы правило оставалось в одном месте.
        var today = DateOnly.FromDateTime(DateTime.Today);
        var dogBornBefore = SeniorBirthCutoff(Species.Dog, today);
        var catBornBefore = SeniorBirthCutoff(Species.Cat, today);
        var ferretBornBefore = SeniorBirthCutoff(Species.Ferret, today);
        var rabbitBornBefore = SeniorBirthCutoff(Species.Rabbit, today);

        // AdministeredAt - timestamptz, параметр должен быть Kind=Utc.
        var rabiesValidSince = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .Where(p => p.Owner.SmsConsent)
            .Where(p =>
                (p.Species == Species.Dog && p.BirthDate <= dogBornBefore) ||
                (p.Species == Species.Cat && p.BirthDate <= catBornBefore) ||
                (p.Species == Species.Ferret && p.BirthDate <= ferretBornBefore) ||
                (p.Species == Species.Rabbit && p.BirthDate <= rabbitBornBefore))
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesValidSince))
            .OrderBy(p => p.Owner.FullName)
            .ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // Для вида без программы возвращает дату, раньше которой никто не родился, - условие не выполнится.
    private static DateOnly SeniorBirthCutoff(Species species, DateOnly today) =>
        Pet.SeniorAgeYears(species) is int seniorAge ? today.AddYears(-seniorAge) : DateOnly.MinValue;
}
```

### OwnerService.cs (изменён)
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record PetSummary(int Id, string Name, Species Species, int AgeYears);

public record OwnerLookupResult(int Id, string FullName, string Phone, string? Email, List<PetSummary> Pets);

public class OwnerService(ClinicDbContext db)
{
    public async Task<Owner?> FindByEmailAsync(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await db.Owners
            .Include(o => o.Pets)
            .SingleOrDefaultAsync(o => o.Email == normalized);
    }

    // Номер не уникален (семья на одном телефоне) - возвращаются все владельцы с этим номером.
    // Некорректный номер - ArgumentException из PhoneFormat.Normalize.
    public async Task<List<OwnerLookupResult>> FindByPhoneAsync(string phone, CancellationToken ct = default)
    {
        var normalized = PhoneFormat.Normalize(phone);

        var owners = await db.Owners
            .Where(o => o.Phone == normalized)
            .OrderBy(o => o.FullName)
            .ThenBy(o => o.Id)
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
            .ToListAsync(ct);

        // Возраст считается в памяти по уже выбранной дате рождения - тем же правилом, что Pet.AgeYears.
        var today = DateOnly.FromDateTime(DateTime.Today);
        return owners
            .Select(o => new OwnerLookupResult(
                o.Id,
                o.FullName,
                o.Phone,
                o.Email,
                o.Pets.Select(p => new PetSummary(p.Id, p.Name, p.Species, Pet.AgeOn(p.BirthDate, today))).ToList()))
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

    // Отказ от SMS. Один атомарный UPDATE: не затирает параллельные правки других полей владельца.
    // Повторный отказ ничего не меняет и не сдвигает SmsConsentChangedAt.
    public async Task RevokeSmsConsentAsync(int ownerId, CancellationToken ct = default)
    {
        // SmsConsentChangedAt - timestamptz, пишем только Kind=Utc.
        var now = DateTime.UtcNow;

        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                .SetProperty(o => o.SmsConsentChangedAt, now), ct);

        if (updated == 0 && !await db.Owners.AnyAsync(o => o.Id == ownerId, ct))
            throw new InvalidOperationException($"Владелец {ownerId} не найден.");
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

    public int AgeYears => AgeOn(BirthDate, DateOnly.FromDateTime(DateTime.Today));

    public static int AgeOn(DateOnly birthDate, DateOnly today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate > today.AddYears(-age))
            age--;
        return age;
    }

    // Правило клиники: с какого возраста питомец считается возрастным
    // (для возрастных действует своя программа напоминаний).
    // null - для вида программа не действует.
    public static int? SeniorAgeYears(Species species) => species switch
    {
        Species.Dog => 8,
        Species.Cat => 10,
        Species.Ferret => 5,
        Species.Rabbit => 6,
        _ => null
    };

    public bool IsSenior => SeniorAgeYears(Species) is int seniorAge && AgeYears >= seniorAge;
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