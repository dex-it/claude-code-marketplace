Все три задачи сделаны. Сборку и тесты я не запускал, как вы и просили.

## Файлы
- **Создан** `ReminderReportService.cs` — ночной отчёт для SMS-рассылки (а).
- **Изменён** `OwnerService.cs` — поиск по телефону `FindByPhoneAsync` (б) и отказ от SMS `RevokeSmsConsentAsync` (в).
- **Изменён** `Domain.cs` — правило «возрастной питомец» и расчёт возраста вынесены в статические методы `Pet`. `IsSenior` и `AgeYears` работают на них, их поведение не изменилось.
- **Создан** `_answer.md` — этот же ответ.

## Решения
- **(а)** `Pet.IsSenior` считается в C# и в SQL не переводится. Поэтому я заменил правило на пороги даты рождения по видам: «возраст ≥ N лет» означает «дата рождения ≤ сегодня минус N лет». Весь фильтр выполняется в базе: согласие на SMS, возраст и отсутствие прививки от бешенства за последние 12 месяцев. Отчёт только читает данные и ничего не отслеживает, а 250 тыс. питомцев и 1,5 млн прививок в память не загружаются. Время передаётся в UTC, как требует Npgsql для этого типа колонки.
- **(б)** Один номер бывает записан на нескольких членов семьи, поэтому метод возвращает список владельцев, а не одного. Номер приводится к единому виду через `PhoneFormat.Normalize`, а неправильный номер вызывает `ArgumentException`. Возраст считается по тому же правилу, что и `Pet.AgeYears`.
- **(в)** Отказ записывается одним UPDATE с условием «согласие сейчас включено». Повторный звонок не сдвигает дату в `SmsConsentChangedAt`, а одновременная правка контактов не теряется. Время пишется в UTC. Если владельца нет, метод бросает `InvalidOperationException`.

## ReminderReportService.cs (новый)
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Возрастные питомцы (Pet.IsSenior) без прививки от бешенства за последние 12 месяцев,
    // владелец которых согласен на SMS. Только чтение: проекция, без трекинга.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        // Pet.IsSenior вычисляется в C# и в SQL не транслируется - правило переводится
        // в пороги даты рождения по видам, чтобы фильтр целиком выполнялся в БД.
        var today = DateOnly.FromDateTime(DateTime.Today);
        var dogCutoff = SeniorCutoff(Species.Dog, today);
        var catCutoff = SeniorCutoff(Species.Cat, today);
        var ferretCutoff = SeniorCutoff(Species.Ferret, today);
        var rabbitCutoff = SeniorCutoff(Species.Rabbit, today);

        // AdministeredAt - timestamptz, параметр должен быть Kind=Utc.
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .Where(p => p.Owner.SmsConsent)
            .Where(p =>
                (p.Species == Species.Dog && p.BirthDate <= dogCutoff) ||
                (p.Species == Species.Cat && p.BirthDate <= catCutoff) ||
                (p.Species == Species.Ferret && p.BirthDate <= ferretCutoff) ||
                (p.Species == Species.Rabbit && p.BirthDate <= rabbitCutoff))
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt >= rabiesCutoff))
            .OrderBy(p => p.OwnerId).ThenBy(p => p.Name)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    private static DateOnly SeniorCutoff(Species species, DateOnly today) =>
        Pet.SeniorBirthDateCutoff(species, today)
            ?? throw new InvalidOperationException($"Для вида {species} не задан возраст возрастной программы");
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

    // Номер не уникален (семья на одном телефоне) - возвращаются все владельцы с этим номером.
    // Некорректный номер - ArgumentException из PhoneFormat.Normalize.
    public async Task<List<OwnerLookup>> FindByPhoneAsync(string phone)
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

        // Возраст считается после выборки: Pet.AgeYears в SQL не транслируется.
        var today = DateOnly.FromDateTime(DateTime.Today);
        return owners
            .Select(o => new OwnerLookup(
                o.Id,
                o.FullName,
                o.Phone,
                o.Email,
                o.Pets
                    .Select(p => new PetSummary(p.Id, p.Name, p.Species, Pet.CalculateAgeYears(p.BirthDate, today)))
                    .ToList()))
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

    // Одним UPDATE ... WHERE sms_consent: повторный отказ не сдвигает момент изменения
    // и не затирает параллельную правку других полей владельца.
    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var now = DateTime.UtcNow;   // SmsConsentChangedAt - timestamptz, Kind=Utc
        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                .SetProperty(o => o.SmsConsentChangedAt, now));

        if (updated == 0 && !await db.Owners.AnyAsync(o => o.Id == ownerId))
            throw new InvalidOperationException($"Владелец {ownerId} не найден");
    }
}

public record OwnerLookup(int Id, string FullName, string Phone, string? Email, List<PetSummary> Pets);

public record PetSummary(int Id, string Name, Species Species, int AgeYears);

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

    public int AgeYears => CalculateAgeYears(BirthDate, DateOnly.FromDateTime(DateTime.Today));

    public static int CalculateAgeYears(DateOnly birthDate, DateOnly today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate > today.AddYears(-age))
            age--;
        return age;
    }

    // Правило клиники: с какого возраста питомец считается возрастным
    // (для возрастных действует своя программа напоминаний).
    public bool IsSenior => SeniorAgeYears(Species) is int seniorAge && AgeYears >= seniorAge;

    // null - для вида возрастная программа не действует.
    public static int? SeniorAgeYears(Species species) => species switch
    {
        Species.Dog => 8,
        Species.Cat => 10,
        Species.Ferret => 5,
        Species.Rabbit => 6,
        _ => null
    };

    // Последняя дата рождения, при которой питомец вида на дату today уже возрастной
    // (AgeYears >= N  <=>  BirthDate <= today.AddYears(-N)). Нужна для фильтра в SQL.
    public static DateOnly? SeniorBirthDateCutoff(Species species, DateOnly today) =>
        SeniorAgeYears(species) is int seniorAge ? today.AddYears(-seniorAge) : null;
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