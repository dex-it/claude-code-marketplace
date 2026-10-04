Сделал все три задачи. Сборку и тесты не запускал — так было в условии.

## Созданные и изменённые файлы
- **`ReminderReportService.cs`** — новый. Метод `GetSeniorRabiesRemindersAsync` возвращает строки отчёта: кличка, вид, ФИО владельца, телефон.
- **`OwnerService.cs`** — изменён. Добавлены `FindByPhoneAsync` (возвращает DTO `OwnerWithPets` / `PetSummary`) и `RevokeSmsConsentAsync`.
- **`Domain.cs`** — изменён. Пороги возраста для «возрастных» питомцев вынесены в таблицу `Pet.SeniorAgeYears`, расчёт возраста — в `Pet.AgeOn`. `IsSenior` и `AgeYears` работают как раньше.
- **`_answer.md`** — этот же ответ.

### ReminderReportService.cs
```csharp
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

// Scoped-сервис: при запуске из BackgroundService/планировщика создавать на каждый прогон
// свой scope (IServiceScopeFactory), а не держать ClinicDbContext из конструктора.
public class ReminderReportService(ClinicDbContext db)
{
    // Ночной отчёт для SMS-рассылки программы возрастных питомцев:
    // возрастной питомец (Pet.IsSenior), прививки от бешенства не было за последние 12 месяцев
    // (или не было вовсе), владелец дал согласие на SMS.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        // AdministeredAt - timestamptz, параметр сравнения должен быть Kind=Utc.
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);

        // Вся фильтрация в SQL; из БД приходят только четыре нужных столбца, без трекинга.
        return await db.Pets
            .Where(SeniorOn(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .OrderBy(p => p.Owner.FullName).ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // Pet.IsSenior вычисляется в памяти и в SQL не транслируется. Эквивалент для запроса:
    // AgeYears >= N  <=>  BirthDate <= today.AddYears(-N), по каждому виду из Pet.SeniorAgeYears:
    // (Species = Dog AND BirthDate <= ...) OR (Species = Cat AND BirthDate <= ...) OR ...
    private static Expression<Func<Pet, bool>> SeniorOn(DateOnly today)
    {
        var p = Expression.Parameter(typeof(Pet), "p");
        Expression body = Expression.Constant(false);

        foreach (var (species, minAge) in Pet.SeniorAgeYears)
        {
            var bornOnOrBefore = today.AddYears(-minAge);
            var clause = Expression.AndAlso(
                Expression.Equal(Expression.Property(p, nameof(Pet.Species)), Expression.Constant(species)),
                Expression.LessThanOrEqual(Expression.Property(p, nameof(Pet.BirthDate)), Expression.Constant(bornOnOrBefore)));
            body = Expression.OrElse(body, clause);
        }

        return Expression.Lambda<Func<Pet, bool>>(body, p);
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

    // Телефон не уникален (семья на одном номере) - возвращаем всех найденных клиентов.
    public async Task<List<OwnerWithPets>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);
        var today = DateOnly.FromDateTime(DateTime.Today);

        var owners = await db.Owners
            .Where(o => o.Phone == normalized)
            .OrderBy(o => o.FullName).ThenBy(o => o.Id)
            .Select(o => new
            {
                o.Id,
                o.FullName,
                o.Phone,
                Pets = o.Pets
                    .OrderBy(p => p.Name)
                    .Select(p => new { p.Name, p.Species, p.BirthDate })
                    .ToList()
            })
            .ToListAsync();

        // Возраст считается в памяти по уже загруженной дате рождения.
        return owners
            .Select(o => new OwnerWithPets(
                o.Id,
                o.FullName,
                o.Phone,
                o.Pets.Select(p => new PetSummary(p.Name, p.Species, Pet.AgeOn(p.BirthDate, today))).ToList()))
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

    // Отказ от SMS. Атомарный UPDATE ... WHERE sms_consent: при параллельных вызовах
    // момент изменения фиксируется один раз, повторный отказ ничего не меняет.
    // Возвращает true, если согласие было и снято; false - если его уже не было.
    public async Task<bool> RevokeSmsConsentAsync(int ownerId)
    {
        var changedAt = DateTime.UtcNow;   // timestamptz - только Kind=Utc
        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                .SetProperty(o => o.SmsConsentChangedAt, changedAt));

        if (updated > 0)
            return true;

        if (!await db.Owners.AnyAsync(o => o.Id == ownerId))
            throw new KeyNotFoundException($"Владелец {ownerId} не найден");

        return false;
    }
}

public record OwnerWithPets(int Id, string FullName, string Phone, List<PetSummary> Pets);

public record PetSummary(string Name, Species Species, int AgeYears);

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
    // Виды, которых нет в таблице, возрастными не считаются.
    // Таблица используется и в SQL-фильтре ReminderReportService.
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

## Решения
- **(а)** `Pet.IsSenior` считается в памяти, и в SQL его перевести нельзя. Поэтому отчёт строит из той же таблицы порогов равносильное условие для базы: `(вид = X И дата рождения <= сегодня − N лет) ИЛИ …`. Проверки на прививку от бешенства за последние 12 месяцев и на согласие на SMS тоже выполняются в базе. Из базы приходят только четыре нужных столбца, без отслеживания изменений, а 250 тыс. питомцев в память не загружаются.
- **(б)** Один номер бывает записан на нескольких членов семьи, поэтому `FindByPhoneAsync` возвращает список всех найденных клиентов, а не одного. Владельцы и их питомцы загружаются одним запросом. На некорректный номер метод бросает `ArgumentException`, как и `CreateAsync`.
- **(в)** Согласие снимается одним атомарным `ExecuteUpdate`, который срабатывает только если согласие ещё есть. Поэтому при повторном или одновременном звонке время отказа не перезапишется. Метод возвращает `false`, если согласия уже не было, и бросает `KeyNotFoundException`, если владельца с таким Id нет.