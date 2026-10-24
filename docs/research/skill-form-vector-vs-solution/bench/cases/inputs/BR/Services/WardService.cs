using Microsoft.EntityFrameworkCore;
using VetClinic.Hospital.Data;
using VetClinic.Hospital.Domain;

namespace VetClinic.Hospital.Services;

public record WardPatientRow(int StayId, string PetName, string BoxCode, DateOnly AdmittedOn, string Reason);
public record BoxCardDto(string Code, string Ward, int Capacity, string? PetName, DateOnly? AdmittedOn);
public record MedicationOrderInput(string Drug, decimal DoseMg, string Route, int TimesPerDay);
public record MedicationOrderDto(int Id, string Drug, decimal DoseMg, string Route, int TimesPerDay);
public record ObservationDto(DateTime TakenAt, decimal TemperatureC, int HeartRate, string? Note);
public record StayCardDto(int StayId, DateOnly AdmittedOn, DateOnly? DischargedOn, string Reason,
    List<MedicationOrderDto> Orders, List<ObservationDto> Observations);

public class WardService(ClinicDbContext db)
{
    // Список пациентов отделения (экран ресепшена и врачей)
    public async Task<List<WardPatientRow>> GetWardPatientsAsync(string ward) =>
        await db.Stays
            .Where(s => s.DischargedOn == null && s.Box.Ward == ward)
            .OrderBy(s => s.Box.Code)
            .Select(s => new WardPatientRow(s.Id, s.Pet.Name, s.Box.Code, s.AdmittedOn, s.Reason))
            .ToListAsync();

    // Обход главврача: госпитализации дольше двух недель
    public async Task<List<WardPatientRow>> GetLongStaysAsync() =>
        await db.Stays
            .Where(s => s.DischargedOn == null && s.DaysInWard > 14)
            .OrderBy(s => s.AdmittedOn)
            .Select(s => new WardPatientRow(s.Id, s.Pet.Name, s.Box.Code, s.AdmittedOn, s.Reason))
            .ToListAsync();

    // Карточка бокса: кто сейчас в боксе
    public async Task<BoxCardDto?> GetBoxCardAsync(int boxId)
    {
        var box = await db.Boxes.AsNoTracking().SingleOrDefaultAsync(b => b.Id == boxId);
        if (box is null)
            return null;

        var current = await db.Stays
            .AsNoTracking()
            .Include(s => s.Pet)
            .SingleOrDefaultAsync(s => s.BoxId == boxId && s.DischargedOn == null);

        return new BoxCardDto(box.Code, box.Ward, box.Capacity, current?.Pet.Name, current?.AdmittedOn);
    }

    public async Task<Box?> FindBoxByCodeAsync(string code) =>
        await db.Boxes.AsNoTracking().SingleOrDefaultAsync(b => b.Code == code);

    // Карточка последней госпитализации питомца для врача
    public async Task<StayCardDto?> GetLatestStayAsync(int petId)
    {
        var stay = await db.Stays
            .AsNoTracking()
            .AsSplitQuery()
            .Include(s => s.MedicationOrders)
            .Include(s => s.Observations)
            .Where(s => s.PetId == petId)
            .OrderByDescending(s => s.AdmittedOn)
            .FirstOrDefaultAsync();

        if (stay is null)
            return null;

        return new StayCardDto(
            stay.Id, stay.AdmittedOn, stay.DischargedOn, stay.Reason,
            stay.MedicationOrders
                .Where(m => m.CancelledAt == null)
                .Select(m => new MedicationOrderDto(m.Id, m.Drug, m.DoseMg, m.Route, m.TimesPerDay))
                .ToList(),
            stay.Observations
                .OrderBy(o => o.TakenAt)
                .Select(o => new ObservationDto(o.TakenAt, o.TemperatureC, o.HeartRate, o.Note))
                .ToList());
    }

    // Врач меняет план назначений целиком
    public async Task ReplaceMedicationPlanAsync(int stayId, IReadOnlyList<MedicationOrderInput> orders)
    {
        var stay = await db.Stays
            .Include(s => s.MedicationOrders)
            .SingleAsync(s => s.Id == stayId);

        stay.MedicationOrders.Clear();
        foreach (var o in orders)
        {
            stay.MedicationOrders.Add(new MedicationOrder
            {
                Drug = o.Drug.Trim(),
                DoseMg = o.DoseMg,
                Route = o.Route,
                TimesPerDay = o.TimesPerDay
            });
        }

        await db.SaveChangesAsync();
    }

    public async Task DecommissionBoxAsync(int boxId)
    {
        var box = await db.Boxes.SingleAsync(b => b.Id == boxId);
        box.IsDecommissioned = true;
        box.DecommissionedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<decimal> DischargeAsync(int stayId, DateOnly dischargedOn)
    {
        var stay = await db.Stays
            .Include(s => s.Box)
            .SingleAsync(s => s.Id == stayId);

        if (stay.DischargedOn is not null)
            throw new InvalidOperationException("Пациент уже выписан");
        if (dischargedOn < stay.AdmittedOn)
            throw new ArgumentException("Дата выписки раньше даты поступления", nameof(dischargedOn));

        var days = dischargedOn.DayNumber - stay.AdmittedOn.DayNumber;
        stay.DischargedOn = dischargedOn;
        stay.TotalCost = days * stay.Box.DailyRate;

        await db.SaveChangesAsync();
        return stay.TotalCost.Value;
    }
}
