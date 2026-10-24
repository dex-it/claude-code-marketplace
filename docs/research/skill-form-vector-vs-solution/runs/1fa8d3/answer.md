## Изменённые/новые файлы

- **Новый**: `ReminderReportService.cs` — сервис `ReminderReportService.GetOverdueRabiesReportAsync()` и DTO `ReminderReportRow`.
- **Изменён**: `OwnerService.cs` — добавлены методы `FindByPhoneAsync` и `RevokeSmsConsentAsync`.

### ReminderReportService.cs
```csharp
using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Data;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Services;

public record ReminderReportRow(string PetName, Species Species, string OwnerFullName, string OwnerPhone);

public class ReminderReportService(ClinicDbContext db)
{
    // Pet.IsSenior вычисляется в памяти (switch + DateTime.Today) и не транслируется EF Core,
    // поэтому тот же порог возраста выражается в IQueryable через пороговые даты по видам -
    // условие целиком остаётся в запросе и не требует материализации 250 тыс. питомцев.
    public async Task<List<ReminderReportRow>> GetOverdueRabiesReportAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var dogThreshold = today.AddYears(-8);
        var catThreshold = today.AddYears(-10);
        var ferretThreshold = today.AddYears(-5);
        var rabbitThreshold = today.AddYears(-6);
        var rabiesCutoff = DateTime.UtcNow.AddMonths(-12);

        return await db.Pets
            .Where(p => p.Owner.SmsConsent)
            .Where(p =>
                (p.Species == Species.Dog && p.BirthDate <= dogThreshold) ||
                (p.Species == Species.Cat && p.BirthDate <= catThreshold) ||
                (p.Species == Species.Ferret && p.BirthDate <= ferretThreshold) ||
                (p.Species == Species.Rabbit && p.BirthDate <= rabbitThreshold))
            .Where(p => !p.Vaccinations.Any(v =>
                v.VaccineCode == VaccineCodes.Rabies && v.AdministeredAt > rabiesCutoff))
            .AsNoTracking()
            .Select(p => new ReminderReportRow(p.Name, p.Species, p.Owner.FullName, p.Owner.Phone))
            .ToListAsync(ct);
    }
}
```

### OwnerService.cs (целиком)
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

    // Телефон не уникален (может быть записан на несколько членов семьи),
    // поэтому неоднозначность возвращается явно - списком, а не выбором "первого".
    public async Task<List<Owner>> FindByPhoneAsync(string phone)
    {
        var normalized = PhoneFormat.Normalize(phone);
        return await db.Owners
            .Include(o => o.Pets)
            .AsNoTracking()
            .Where(o => o.Phone == normalized)
            .ToListAsync();
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

    public async Task RevokeSmsConsentAsync(int ownerId)
    {
        var owner = await db.Owners.SingleAsync(o => o.Id == ownerId);
        owner.SmsConsent = false;
        owner.SmsConsentChangedAt = DateTime.UtcNow;
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

### Решения
- **(а)** `Pet.IsSenior` не транслируется EF Core (зависит от `DateTime.Today` и switch в памяти), поэтому порог возраста выражен прямо в `IQueryable` через пороговые даты по видам; условие по бешенству — `!Vaccinations.Any(...)` с cutoff в 12 месяцев, запрос идёт одним проходом по БД с проекцией и `AsNoTracking`, без материализации 250 тыс. питомцев.
- **(б)** Телефон у `Owner` не unique (есть явный комментарий в домене), поэтому `FindByPhoneAsync` возвращает `List<Owner>`, а не "первого попавшегося" — неоднозначность не скрывается молча; номер нормализуется тем же `PhoneFormat.Normalize`.
- **(в)** `RevokeSmsConsentAsync` по аналогии с `UpdateContactsAsync` берёт владельца по `Id` (`SingleAsync`) и пишет `SmsConsentChangedAt = DateTime.UtcNow` (Kind=Utc для `timestamptz`).

Ответ также сохранён в `_answer.md`.