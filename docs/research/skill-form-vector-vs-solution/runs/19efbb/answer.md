Все три задачи сделаны. Сборку и тесты я не запускал, так что код не компилировался и не проверялся. Этот же ответ записан в `_answer.md`.

## Файлы
- `ReminderReportService.cs` — новый: ночной отчёт `GetSeniorRabiesRemindersAsync` (а) и тип строки `SeniorRabiesReminderRow`.
- `OwnerService.cs` — изменён: поиск `FindByPhoneAsync` (б), отказ от SMS `RevokeSmsConsentAsync` (в), типы результата `OwnerCard` и `PetSummary`.
- `Domain.cs` — изменён: правило «возрастного» питомца собрано в одном месте, `Pet.SeniorAgeBySpecies`. Добавлены `Pet.AgeOn` и `Pet.IsSeniorOn(today)` — тот же фильтр, но в виде, который EF переводит в SQL. Свойства `IsSenior` и `AgeYears` работают как раньше.

## Решения
- **(а)** `IsSenior` считается в C#, поэтому в SQL его не перевести. Я переписал правило как эквивалентное условие для каждого вида: `BirthDate <= today.AddYears(-N)`. Весь фильтр выполняется в базе: возрастной питомец, согласие владельца на SMS, нет прививки от бешенства за последние 12 месяцев. Запрос может использовать существующие индексы `(Species, BirthDate)` и `(PetId, VaccineCode, AdministeredAt)`. Из базы читаются только четыре поля отчёта, без трекинга.
- **(б)** Введённый номер приводится через `PhoneFormat.Normalize`. По домену один номер может принадлежать нескольким членам семьи, поэтому метод возвращает список всех таких владельцев, а не одного. Если номер не распознан, `Normalize` бросает `ArgumentException` — так же, как при создании клиента.
- **(в)** Согласие снимается одним атомарным `UPDATE` только там, где оно ещё стоит, поэтому одновременные правки владельца не теряются. `SmsConsentChangedAt` (UTC) записывается только при реальном изменении, повторный вызов ничего не меняет. Если владельца нет, бросается `InvalidOperationException`.

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
    // Возрастные питомцы без прививки от бешенства за последние 12 месяцев, владелец согласен на SMS.
    // Весь фильтр выполняется в БД, читаются только поля строки отчёта (проекция, без трекинга).
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);   // как в Pet.AgeYears
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);   // AdministeredAt - timestamptz, параметр Kind=Utc

        return await db.Pets
            .Where(Pet.IsSeniorOn(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v => v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt >= rabiesCutoff))
            .OrderBy(p => p.Owner.FullName).ThenBy(p => p.OwnerId).ThenBy(p => p.Name)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
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

    // Номер не уникален (семья на одном телефоне) - возвращаются все владельцы с этим номером.
    public async Task<List<OwnerCard>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);
        var owners = await db.Owners
            .Where(o => o.Phone == normalized)
            .OrderBy(o => o.FullName).ThenBy(o => o.Id)
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

    // Один атомарный UPDATE: параллельные правки владельца не затираются,
    // а момент изменения фиксируется только при реальном снятии согласия (повторный вызов ничего не меняет).
    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var changedAt = DateTime.UtcNow;   // колонка timestamptz - пишется Kind=Utc
        var updated = await db.Owners
            .Where(o => o.Id == ownerId && o.SmsConsent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.SmsConsent, false)
                .SetProperty(o => o.SmsConsentChangedAt, changedAt));

        if (updated == 0 && !await db.Owners.AnyAsync(o => o.Id == ownerId))
            throw new InvalidOperationException($"Владелец {ownerId} не найден");
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

### Domain.cs
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
    // Виды, которых нет в словаре, возрастными не считаются.
    public static readonly IReadOnlyDictionary<Species, int> SeniorAgeBySpecies = new Dictionary<Species, int>
    {
        [Species.Dog] = 8,
        [Species.Cat] = 10,
        [Species.Ferret] = 5,
        [Species.Rabbit] = 6
    };

    public bool IsSenior => SeniorAgeBySpecies.TryGetValue(Species, out var seniorAge) && AgeYears >= seniorAge;

    // То же правило, что IsSenior, в виде, который EF Core переводит в SQL:
    // AgeOn(BirthDate, today) >= N  <=>  BirthDate <= today.AddYears(-N).
    public static Expression<Func<Pet, bool>> IsSeniorOn(DateOnly today)
    {
        var p = Expression.Parameter(typeof(Pet), "p");
        Expression? body = null;
        foreach (var (species, seniorAge) in SeniorAgeBySpecies)
        {
            var condition = Expression.AndAlso(
                Expression.Equal(Expression.Property(p, nameof(Species)), Expression.Constant(species)),
                Expression.LessThanOrEqual(Expression.Property(p, nameof(BirthDate)), Expression.Constant(today.AddYears(-seniorAge))));
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