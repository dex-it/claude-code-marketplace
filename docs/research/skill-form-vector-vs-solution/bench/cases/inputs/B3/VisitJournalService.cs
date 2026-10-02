using Microsoft.EntityFrameworkCore;
using VetClinic.Journal.Data;

namespace VetClinic.Journal.Services;

public record VisitRow(int Id, DateTime SlotStartUtc, string PetName, string VetName, string Complaint, string? Diagnosis);

public class VisitJournalService(ClinicDbContext db)
{
    private const int PageSize = 50;

    // Полнотекстовый поиск по жалобе (индекс ix_visits_complaint_fts)
    public async Task<IReadOnlyList<VisitRow>> SearchAsync(string text, int page)
    {
        return await db.Visits
            .FromSqlRaw(
                """
                SELECT * FROM "Visits"
                WHERE to_tsvector('russian', "Complaint") @@ plainto_tsquery('russian', {0})
                """,
                text)
            .OrderByDescending(v => v.SlotStart)
            .Skip(page * PageSize)
            .Take(PageSize)
            .Select(v => new VisitRow(v.Id, v.SlotStart, v.Pet.Name, v.Vet.FullName, v.Complaint, v.Diagnosis))
            .ToListAsync();
    }
}
