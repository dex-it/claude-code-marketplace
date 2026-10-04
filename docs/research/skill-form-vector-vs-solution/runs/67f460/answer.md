Все три задачи сделаны. Сборку и тесты я не запускал, как и требовало поручение, поэтому код не проверен. Этот же ответ записан в `_answer.md`.

## Файлы
- **`ReminderReportService.cs`** (новый): метод `GetSeniorRabiesRemindersAsync` возвращает строки отчёта (кличка, вид, ФИО владельца, телефон).
- **`OwnerService.cs`** (изменён): добавлены `FindByPhoneAsync` и `RevokeSmsConsentAsync`, а также типы `OwnerCard` и `PetSummary` для поиска по телефону.
- **`Domain.cs`** (изменён): пороги возраста вынесены в `Pet.SeniorAgeYears`, возраст считает `Pet.AgeOn`. `IsSenior` и `AgeYears` работают как раньше.

## Решения
- **(а) Отчёт.** EF не может перевести `IsSenior` в SQL, потому что это вычисляемое свойство. Поэтому в запросе правило записано как условие по колонкам: `Species = X AND BirthDate <= сегодня − N лет`. Пороги берутся из той же таблицы `SeniorAgeYears`, и в отчёте возрастными считаются те же питомцы, что и по `IsSenior`. Условие по прививке от бешенства превращается в `NOT EXISTS`, для него уже есть индекс `(PetId, VaccineCode, AdministeredAt)`. Весь фильтр, включая согласие на SMS, выполняется в базе, и из неё читаются только четыре нужных столбца. Граница «12 месяцев назад» берётся в UTC, потому что колонка даты прививки хранится с часовым поясом (`timestamptz`).
- **(б) Поиск по телефону.** Один номер может быть у нескольких членов семьи, поэтому метод возвращает список всех владельцев с этим номером. Номер в любом формате приводится к одному виду через `PhoneFormat.Normalize`. Если номер некорректный, метод выбрасывает `ArgumentException`: экрану нужно перехватить его и показать сообщение. Данные загружаются одним запросом, возраст питомца считается после загрузки.
- **(в) Отказ от SMS.** Сделан одной командой `ExecuteUpdate`, поэтому одновременная правка контактов этого владельца не затрёт отказ, и наоборот. Если согласие уже снято, время изменения не перезаписывается. Если владельца с таким Id нет, метод выбрасывает `KeyNotFoundException`.

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
    // Ночной отчёт для SMS по программе возрастных питомцев:
    // возрастной питомец, согласие владельца на SMS, прививки от бешенства не было
    // или последняя сделана больше 12 месяцев назад.
    // Весь фильтр выполняется в SQL; из БД приходят только четыре нужных столбца.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        // AdministeredAt - timestamptz, параметр сравнения должен быть Kind=Utc.
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .Where(BuildIsSeniorFilter(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .OrderBy(p => p.Owner.FullName)
            .ThenBy(p => p.OwnerId)
            .ThenBy(p => p.Name)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // Pet.IsSenior вычисляется в памяти и в SQL не транслируется. Переводим правило
    // в условие по маппленным колонкам: AgeYears >= N  <=>  BirthDate <= today - N лет.
    // Получается (Species = Dog AND BirthDate <= ...) OR (Species = Cat AND ...) OR ...
    private static Expression<Func<Pet, bool>> BuildIsSeniorFilter(DateOnly today)
    {
        var pet = Expression.Parameter(typeof(Pet), "p");
        Expression body = Expression.Constant(false);

        foreach (var (species, years) in Pet.SeniorAgeYears)
        {
            var bornOnOrBefore = today.AddYears(-years);
            var condition = Expression.AndAlso(
                Expression.Equal(
                    Expression.Property(pet, nameof(Pet.Species)),
                    Expression.Constant(species)),
                Expression.LessThanOrEqual(
                    Expression.Property(pet, nameof(Pet.BirthDate)),
                    Expression.Constant(bornOnOrBefore)));
            body = Expression.OrElse(body, condition);
        }

        return Expression.Lambda<Func<Pet, bool>>(body, pet);
    }
}
```

### OwnerService.cs (изменён)
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

    // Телефон не уникален (семья на одном номере), поэтому возвращаются все владельцы с этим номером.
    // Некорректный номер - ArgumentException из PhoneFormat.Normalize.
    public async Task<List<OwnerCard>> FindByPhoneAsync(string phone)
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
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Today);
        return owners
            .Select(o => new OwnerCard(
                o.Id, o.FullName, o.Phone, o.Email,
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

    // Отказ от SMS. Один атомарный UPDATE: параллельная правка контактов его не затрёт и он её тоже.
    // Если согласие уже снято, момент последнего изменения не сдвигается.
    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                // timestamptz - только Kind=Utc
                .SetProperty(o => o.SmsConsentChangedAt, DateTime.UtcNow));

        if (updated == 0 && !await db.Owners.AnyAsync(o => o.Id == ownerId))
            throw new KeyNotFoundException($"Владелец {ownerId} не найден");
    }
}

public record PetSummary(int Id, string Name, Species Species, int AgeYears);

public record OwnerCard(int Id, string FullName, string Phone, string? Email, List<PetSummary> Pets);

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
    // Виды, которых нет в таблице, возрастными не считаются.
    // Таблица используется и в SQL-фильтре ReminderReportService - менять пороги только здесь.
    public static readonly IReadOnlyDictionary<Species, int> SeniorAgeYears = new Dictionary<Species, int>
    {
        [Species.Dog] = 8,
        [Species.Cat] = 10,
        [Species.Ferret] = 5,
        [Species.Rabbit] = 6
    };

    public bool IsSenior => SeniorAgeYears.TryGetValue(Species, out var years) && AgeYears >= years;
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