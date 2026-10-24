Все три задачи сделаны. Сборку и тесты не запускал, как и просили, поэтому код не проверен. Этот же ответ записан в `_answer.md`.

## Файлы
- `ReminderReportService.cs` — новый: `GetSeniorRabiesRemindersAsync()` и `SeniorRabiesReminderRow` (кличка, вид, ФИО владельца, телефон).
- `OwnerService.cs` — изменён: добавлены `FindByPhoneAsync(phone)` (возвращает `List<OwnerCard>` с `PetSummary`: кличка, вид, возраст) и `RevokeSmsConsentAsync(ownerId)`.
- `Domain.cs` — изменён: пороги возрастных вынесены в `Pet.SeniorFromAgeYears`, расчёт возраста — в `Pet.AgeYearsOn`. Добавлен `Pet.IsSeniorOn(today)` — то же правило в виде, который EF переводит в SQL. Поведение `IsSenior` и `AgeYears` не изменилось.

## Решения
- **Отчёт.** `IsSenior` вычисляется в C#, и EF не может перевести его в SQL. Поэтому `IsSeniorOn` использует то же правило в форме «дата рождения ≤ сегодня минус N лет» для каждого вида. Правило задано в одном месте, а весь отбор идёт в SQL: возрастные, согласие на SMS и отсутствие прививки от бешенства за 12 месяцев. Для прививок используется существующий индекс `(PetId, VaccineCode, AdministeredAt)`. Из базы приходят только четыре нужных поля, в память сущности не загружаются.
- **Поиск по телефону.** Номер приводится к общему формату через `PhoneFormat.Normalize`. На одном номере бывает несколько членов семьи, поэтому метод возвращает список клиентов, а не одного. Владельцы и их питомцы приходят одним запросом, только нужные поля.
- **Отказ от SMS.** Метод выполняет один `UPDATE … WHERE Id = @id AND SmsConsent` и ставит время в UTC. Это атомарно и не затирает параллельные правки других полей владельца. При повторном отказе `SmsConsentChangedAt` не меняется. Метод возвращает `true`, если согласие снято сейчас, и `false`, если оно уже было снято. Если владельца с таким Id нет, бросается `KeyNotFoundException`.

---

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
    // владелец которых согласен на SMS. Весь фильтр выполняется в SQL,
    // из БД приходят только четыре поля нужных строк (без трекинга).
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);   // как в Pet.AgeYears
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);   // timestamptz - только Kind=Utc

        return await db.Pets
            .Where(Pet.IsSeniorOn(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .OrderBy(p => p.Owner.FullName)
            .ThenBy(p => p.OwnerId)
            .ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
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

    // Телефон не уникален (семья на одном номере) - возвращаются все владельцы.
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
                    .Select(p => new { p.Name, p.Species, p.BirthDate })
                    .ToList()
            })
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Today);
        return owners
            .Select(o => new OwnerCard(
                o.Id,
                o.FullName,
                o.Phone,
                o.Email,
                o.Pets.Select(p => new PetSummary(p.Name, p.Species, Pet.AgeYearsOn(p.BirthDate, today))).ToList()))
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

    // Одним UPDATE ... WHERE sms_consent: атомарно, не затирает параллельные правки
    // других полей; повторный отказ не сдвигает SmsConsentChangedAt.
    // true - согласие снято сейчас, false - уже было снято.
    public async Task<bool> RevokeSmsConsentAsync(int ownerId)
    {
        var now = DateTime.UtcNow;   // timestamptz - только Kind=Utc
        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                .SetProperty(o => o.SmsConsentChangedAt, now));

        if (updated > 0)
            return true;
        if (!await db.Owners.AnyAsync(o => o.Id == ownerId))
            throw new KeyNotFoundException($"Владелец {ownerId} не найден");
        return false;
    }
}

public record PetSummary(string Name, Species Species, int AgeYears);

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
using System.Linq.Expressions;

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

    public int AgeYears => AgeYearsOn(BirthDate, DateOnly.FromDateTime(DateTime.Today));

    public static int AgeYearsOn(DateOnly birthDate, DateOnly today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate > today.AddYears(-age))
            age--;
        return age;
    }

    // Правило клиники: с какого возраста питомец считается возрастным
    // (для возрастных действует своя программа напоминаний).
    public static int? SeniorFromAgeYears(Species species) => species switch
    {
        Species.Dog => 8,
        Species.Cat => 10,
        Species.Ferret => 5,
        Species.Rabbit => 6,
        _ => null
    };

    public bool IsSenior => SeniorFromAgeYears(Species) is int years && AgeYears >= years;

    // То же правило, что IsSenior, но в виде, который EF транслирует в SQL.
    // AgeYearsOn(birth, today) >= N  <=>  birth <= today.AddYears(-N).
    public static Expression<Func<Pet, bool>> IsSeniorOn(DateOnly today)
    {
        var p = Expression.Parameter(typeof(Pet), "p");
        Expression? body = null;
        foreach (var species in Enum.GetValues<Species>())
        {
            if (SeniorFromAgeYears(species) is not int years)
                continue;

            var condition = Expression.AndAlso(
                Expression.Equal(
                    Expression.Convert(Expression.Property(p, nameof(Species)), typeof(int)),
                    Expression.Constant((int)species)),
                Expression.LessThanOrEqual(
                    Expression.Property(p, nameof(BirthDate)),
                    Expression.Constant(today.AddYears(-years))));
            body = body is null ? condition : Expression.OrElse(body, condition);
        }
        return Expression.Lambda<Func<Pet, bool>>(body ?? Expression.Constant(false), p);
    }
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