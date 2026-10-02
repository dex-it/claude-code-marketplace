using Microsoft.EntityFrameworkCore;
using VetClinic.Hospital.Data;

namespace VetClinic.Hospital.Services;

public record OccupancyRow(int StayId, string PetName, string BoxCode, DateOnly AdmittedOn, string Reason);
public record StayHistoryRow(int StayId, DateOnly AdmittedOn, DateOnly? DischargedOn, string Reason, decimal? TotalCost);

public class InpatientReportService(ClinicDbContext db)
{
    // Занятость отделения; sortBy - имя столбца, по которому пользователь отсортировал таблицу на экране
    public async Task<List<OccupancyRow>> GetOccupancyAsync(string ward, string sortBy)
    {
        var sql = $"""
            SELECT s.* FROM "Stays" s
            JOIN "Boxes" b ON b."Id" = s."BoxId"
            WHERE b."Ward" = '{ward}' AND s."DischargedOn" IS NULL
            ORDER BY s."{sortBy}"
            """;

        return await db.Stays
            .FromSqlRaw(sql)
            .AsNoTracking()
            .Select(s => new OccupancyRow(s.Id, s.Pet.Name, s.Box.Code, s.AdmittedOn, s.Reason))
            .ToListAsync();
    }

    // История госпитализаций питомца
    public async Task<List<StayHistoryRow>> GetPetHistoryAsync(int petId) =>
        await db.Stays
            .FromSql($"""SELECT * FROM "Stays" WHERE "PetId" = {petId}""")
            .OrderByDescending(s => s.AdmittedOn)
            .ThenByDescending(s => s.Id)
            .Select(s => new StayHistoryRow(s.Id, s.AdmittedOn, s.DischargedOn, s.Reason, s.TotalCost))
            .ToListAsync();
}
