Все три задачи готовы. Сборку и тесты я не запускал, как ты и просил, поэтому код ни разу не компилировался.

## Файлы

- `ReminderReportService.cs` — **новый**.
- `OwnerService.cs` — **изменён**: добавлены `FindByPhoneAsync` и `RevokeSmsConsentAsync`.
- `Domain.cs` — **изменён**: возрастные пороги по видам вынесены в `Pet.SeniorAgeYears(Species)`. `IsSenior` теперь берёт их оттуда и работает как раньше.
- `_answer.md` — этот же ответ.

## Решения

- **Отчёт (а).** `Pet.IsSenior` считается в C#, и EF не умеет переводить его в SQL. Поэтому я переписал правило как условие на дату рождения для каждого вида: `BirthDate <= today.AddYears(-N)`. Пороги берутся из того же `SeniorAgeYears`, так что правило записано в одном месте. Все условия проверяет база, включая «нет прививки от бешенства за 12 месяцев». Эта проверка опирается на уже существующий индекс по прививкам. В приложение приходят только поля строки отчёта, без отслеживания изменений.
- **Отчёт: повторы номеров.** Строка формируется на каждого питомца. Если у владельца несколько возрастных питомцев, его номер будет в отчёте несколько раз. Строки отсортированы по телефону, так что при рассылке их легко объединить.
- **Поиск по телефону (б).** Метод возвращает **список** владельцев: по комментарию в `Owner.Phone`, один номер может быть записан на нескольких членов семьи. Если номер введён некорректно, `PhoneFormat.Normalize` бросает `ArgumentException`.
- **Отказ от SMS (в).** Время изменения сохраняется в UTC, этого требует Npgsql. Повторный вызов ничего не делает и не перезаписывает время первого отказа. Если владельца с таким Id нет, метод бросает исключение, как и `UpdateContactsAsync`.

## ReminderReportService.cs
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
    // возрастной питомец (правило Pet.IsSenior), прививки от бешенства не было
    // или она была больше 12 месяцев назад, владелец согласен на SMS.
    // Всё фильтруется в БД: Pet.IsSenior - вычисляемое свойство и в SQL не транслируется,
    // поэтому правило переводится в условия на BirthDate (см. SeniorPredicate).
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);   // та же "сегодня", что и в Pet.AgeYears
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);    // timestamptz в Npgsql требует UTC

        return await db.Pets
            .AsNoTracking()
            .Where(SeniorPredicate(today))
            .Where(p => p.Owner.SmsConsent)
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt >= rabiesCutoff))
            .OrderBy(p => p.Owner.Phone)
            .ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }

    // AgeYears >= N  <=>  BirthDate <= today.AddYears(-N) (в т.ч. для родившихся 29 февраля).
    // Строит p => (p.Species == Dog && p.BirthDate <= cutoffDog) || (p.Species == Cat && ...) || ...
    // по порогам из Pet.SeniorAgeYears, чтобы правило не дублировалось.
    private static Expression<Func<Pet, bool>> SeniorPredicate(DateOnly today)
    {
        var p = Expression.Parameter(typeof(Pet), "p");
        Expression body = Expression.Constant(false);

        foreach (var species in Enum.GetValues<Species>())
        {
            if (Pet.SeniorAgeYears(species) is not int seniorAge)
                continue;

            var condition = Expression.AndAlso(
                Expression.Equal(Expression.Property(p, nameof(Pet.Species)), Expression.Constant(species)),
                Expression.LessThanOrEqual(Expression.Property(p, nameof(Pet.BirthDate)),
                    Expression.Constant(today.AddYears(-seniorAge))));

            body = Expression.OrElse(body, condition);
        }

        return Expression.Lambda<Func<Pet, bool>>(body, p);
    }
}
```

## OwnerService.cs
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

    // Номер не уникален (несколько членов семьи на одном телефоне) - возвращаем всех владельцев.
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
            return;   // уже отказался - не перетираем момент первоначального отказа

        owner.SmsConsent = false;
        owner.SmsConsentChangedAt = DateTime.UtcNow;   // timestamptz в Npgsql требует UTC
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

## Domain.cs
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
    public bool IsSenior => SeniorAgeYears(Species) is int seniorAge && AgeYears >= seniorAge;

    // Порог возраста по видам; null - для вида программа не действует.
    // Единственный источник правила: им пользуются и IsSenior, и SQL-отчёты (ReminderReportService).
    public static int? SeniorAgeYears(Species species) => species switch
    {
        Species.Dog => 8,
        Species.Cat => 10,
        Species.Ferret => 5,
        Species.Rabbit => 6,
        _ => null
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