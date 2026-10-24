Все три задачи сделаны. Сборку и тесты я не запускал, как и было сказано. Этот же ответ записан в `_answer.md`.

## Файлы
- **Создан** `ReminderReportService.cs`: метод `GetSeniorRabiesRemindersAsync()` и запись `SeniorRabiesReminderRow`.
- **Изменён** `OwnerService.cs`: добавлены `FindByPhoneAsync()` и `RevokeSmsConsentAsync()`, а также записи `OwnerCard` и `PetSummary`.

## Решения
- **(а) Отчёт.** `Pet.IsSenior` вычисляется в коде, и база данных его выполнить не может. Поэтому правило я перенёс в запрос как граничные даты рождения по видам: «возраст ≥ N лет» значит «родился не позже, чем N лет назад». «Нет прививки от бешенства за последние 12 месяцев» проверяется через `!Any(...)`, в SQL это превращается в `NOT EXISTS`. Весь фильтр выполняется в базе, данные не отслеживаются, из базы читаются только четыре нужных поля.
- **(б) Поиск по телефону.** Номер не уникален, на одном номере бывает целая семья. Поэтому метод возвращает список карточек клиентов, а не одного клиента. Номер в любом формате приводится к единому виду через `PhoneFormat.Normalize`; на некорректный номер он бросает `ArgumentException`. Возраст питомца считается после выборки по тому же правилу, что и `Pet.AgeYears`.
- **(в) Отказ от SMS.** Метод одним `ExecuteUpdateAsync` меняет только два поля, поэтому одновременная правка контактов того же клиента не затирается. Время пишется в UTC. Если согласие уже было снято, время изменения не перезаписывается и метод возвращает `false`. Если владельца с таким Id нет, бросается `KeyNotFoundException`.

## ReminderReportService.cs
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record SeniorRabiesReminderRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Ночной отчёт для SMS-рассылки программы возрастных питомцев:
    // возрастной питомец (правило Pet.IsSenior), прививки от бешенства не было
    // или последняя была больше 12 месяцев назад, владелец согласен на SMS.
    public async Task<List<SeniorRabiesReminderRow>> GetSeniorRabiesRemindersAsync(CancellationToken ct = default)
    {
        // Pet.IsSenior - вычисляемое свойство, в SQL не транслируется. Условие "AgeYears >= N"
        // эквивалентно "BirthDate <= сегодня - N лет" (та же точка отсчёта DateTime.Today, что в Pet.AgeYears),
        // поэтому правило переносится в запрос границами дат рождения по видам.
        var today = DateOnly.FromDateTime(DateTime.Today);
        var dogBornBy = today.AddYears(-8);
        var catBornBy = today.AddYears(-10);
        var ferretBornBy = today.AddYears(-5);
        var rabbitBornBy = today.AddYears(-6);

        // AdministeredAt - timestamptz, параметр передаётся с Kind=Utc.
        var rabiesFreshSince = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .Where(p => p.Owner.SmsConsent)
            .Where(p =>
                (p.Species == Species.Dog && p.BirthDate <= dogBornBy) ||
                (p.Species == Species.Cat && p.BirthDate <= catBornBy) ||
                (p.Species == Species.Ferret && p.BirthDate <= ferretBornBy) ||
                (p.Species == Species.Rabbit && p.BirthDate <= rabbitBornBy))
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt >= rabiesFreshSince))
            .OrderBy(p => p.OwnerId).ThenBy(p => p.Id)
            .Select(p => new SeniorRabiesReminderRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
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

    // Номер не уникален (семья на одном телефоне) - возвращаются все владельцы с этим номером.
    // Некорректный номер - ArgumentException из PhoneFormat.Normalize.
    public async Task<List<OwnerCard>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);
        var rows = await db.Owners
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

        // Возраст считается по правилу Pet.AgeYears после выборки: свойство вычисляемое.
        return rows
            .Select(o => new OwnerCard(
                o.Id, o.FullName, o.Phone, o.Email,
                o.Pets
                    .Select(p => new PetSummary(p.Id, p.Name, p.Species, new Pet { BirthDate = p.BirthDate }.AgeYears))
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

    // Отказ от SMS. Обновляются только два поля одним UPDATE, без чтения сущности, -
    // параллельная правка контактов того же владельца не затирается.
    // Если согласие уже снято, момент изменения не перезаписывается. Возвращает true, если согласие было снято сейчас.
    public async Task<bool> RevokeSmsConsentAsync(int ownerId)
    {
        var now = DateTime.UtcNow;   // timestamptz - Kind=Utc
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

public record OwnerCard(int Id, string FullName, string Phone, string? Email, List<PetSummary> Pets);

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