using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Data;
using VetClinic.Records.Domain;

namespace VetClinic.Records.Services;

public record AllergyInput(string Allergen, string? Reaction, AllergySeverity Severity);
public record AllergyDto(int Id, string Allergen, string? Reaction, AllergySeverity Severity);
public record VisitDto(int Id, DateTime ScheduledAt, string VetName, VisitStatus Status, string? Notes);
public record PetCardDto(int Id, string Name, string Species, string OwnerName,
    List<AllergyDto> Allergies, List<VisitDto> Visits);

public class ClinicCardService(ClinicDbContext db)
{
    public async Task<PetCardDto?> GetPetCardAsync(int petId) =>
        await db.Pets
            .Where(p => p.Id == petId)
            .Select(p => new PetCardDto(
                p.Id, p.Name, p.Species, p.Owner.FullName,
                p.Allergies
                    .Select(a => new AllergyDto(a.Id, a.Allergen, a.Reaction, a.Severity))
                    .ToList(),
                p.Visits
                    .OrderByDescending(v => v.ScheduledAt)
                    .Select(v => new VisitDto(v.Id, v.ScheduledAt, v.VetName, v.Status, v.Notes))
                    .ToList()))
            .SingleOrDefaultAsync();

    // Расписание врача: все запланированные визиты
    public async Task<List<VisitDto>> GetPlannedVisitsAsync(string vetName) =>
        await db.Visits
            .Where(v => v.VetName == vetName && v.Status == VisitStatus.Planned)
            .OrderBy(v => v.ScheduledAt)
            .Select(v => new VisitDto(v.Id, v.ScheduledAt, v.VetName, v.Status, v.Notes))
            .ToListAsync();

    public async Task AddAllergyAsync(int petId, AllergyInput input)
    {
        var pet = await db.Pets.SingleAsync(p => p.Id == petId);
        pet.Allergies.Add(new Allergy
        {
            Allergen = input.Allergen.Trim(),
            Reaction = input.Reaction,
            Severity = input.Severity
        });
        await db.SaveChangesAsync();
    }

    public async Task UpdateVisitNotesAsync(int visitId, string? notes)
    {
        var visit = await db.Visits.SingleAsync(v => v.Id == visitId);
        visit.Notes = notes;
        await db.SaveChangesAsync();
    }
}
