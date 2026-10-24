using Microsoft.EntityFrameworkCore;
using VetClinic.Procedures.Data;
using VetClinic.Procedures.Domain;

namespace VetClinic.Procedures.Services;

public record ScheduleRequest(int PetId, string Title, DateTime ScheduledLocal, int DurationMinutes);
public record ConsumableDto(int Id, string Item, decimal Quantity, string Unit);
public record StaffNoteDto(string Author, string Text, DateTime WrittenAt);
public record ProcedureCardDto(int Id, string PetName, string Title, DateTime ScheduledLocal, int DurationMinutes,
    ProcedureStatus Status, string? Notes, List<ConsumableDto> Consumables, List<StaffNoteDto> StaffNotes);

public class ProcedureService(ClinicDbContext db)
{
    public async Task<int> ScheduleAsync(ScheduleRequest r)
    {
        if (r.DurationMinutes <= 0)
            throw new ArgumentOutOfRangeException(nameof(r), "Длительность должна быть положительной");

        var procedure = new Procedure
        {
            PetId = r.PetId,
            Title = r.Title.Trim(),
            ScheduledLocal = DateTime.SpecifyKind(r.ScheduledLocal, DateTimeKind.Unspecified),
            DurationMinutes = r.DurationMinutes,
            Status = ProcedureStatus.Scheduled,
            CreatedAt = DateTime.UtcNow
        };
        db.Procedures.Add(procedure);
        await db.SaveChangesAsync();
        return procedure.Id;
    }

    public async Task RescheduleAsync(int id, DateTime newScheduledLocal)
    {
        var procedure = await db.Procedures.SingleAsync(p => p.Id == id);
        if (procedure.Status != ProcedureStatus.Scheduled)
            throw new InvalidOperationException("Перенести можно только запланированную процедуру");

        procedure.ScheduledLocal = DateTime.SpecifyKind(newScheduledLocal, DateTimeKind.Unspecified);
        await db.SaveChangesAsync();
    }

    public async Task<ProcedureCardDto?> GetCardAsync(int id)
    {
        var p = await db.Procedures
            .AsNoTracking()
            .AsSplitQuery()
            .Include(x => x.Pet)
            .Include(x => x.Consumables)
            .Include(x => x.StaffNotes)
            .SingleOrDefaultAsync(x => x.Id == id);

        if (p is null)
            return null;

        return new ProcedureCardDto(
            p.Id, p.Pet.Name, p.Title, p.ScheduledLocal, p.DurationMinutes, p.Status, p.Notes,
            p.Consumables.Select(c => new ConsumableDto(c.Id, c.Item, c.Quantity, c.Unit)).ToList(),
            p.StaffNotes.OrderBy(n => n.WrittenAt).Select(n => new StaffNoteDto(n.Author, n.Text, n.WrittenAt)).ToList());
    }

    public async Task RemoveConsumableAsync(int procedureId, int lineId)
    {
        var procedure = await db.Procedures
            .Include(p => p.Consumables)
            .SingleAsync(p => p.Id == procedureId);

        if (procedure.Status == ProcedureStatus.Closed)
            throw new InvalidOperationException("Процедура закрыта, списание менять нельзя");

        var line = procedure.Consumables.SingleOrDefault(c => c.Id == lineId)
            ?? throw new KeyNotFoundException($"Строка {lineId} не найдена в процедуре {procedureId}");

        procedure.Consumables.Remove(line);
        await db.SaveChangesAsync();
    }

    public async Task<Pet?> FindPetByChipAsync(string chip)
    {
        var normalized = chip.Trim();
        return await db.Pets.AsNoTracking().SingleOrDefaultAsync(p => p.ChipNumber == normalized);
    }

    // Объём препарата для инфузии, мл
    public async Task<decimal> CalculateDoseMlAsync(int procedureId, decimal drugMgPerKg, decimal concentrationMgPerMl)
    {
        if (drugMgPerKg <= 0 || concentrationMgPerMl <= 0)
            throw new ArgumentOutOfRangeException(nameof(concentrationMgPerMl), "Доза и концентрация должны быть положительными");

        var weightGrams = await db.Procedures
            .Where(p => p.Id == procedureId)
            .Select(p => p.Pet.WeightGrams)
            .SingleAsync();

        // доза, мг = вес, кг × мг/кг; объём, мл = доза / концентрация (мг/мл)
        var doseMg = weightGrams * drugMgPerKg;
        return Math.Round(doseMg / concentrationMgPerMl, 2);
    }
}
