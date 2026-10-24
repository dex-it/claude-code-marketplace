using Microsoft.EntityFrameworkCore;

namespace Motorpool.Fleet;

public record PermitDto(VehicleClass Class, DateOnly ValidUntil);

public record DriverDto(int Id, string PersonnelNumber, string DisplayName, string Phone, IReadOnlyList<PermitDto> Permits);

public class DriverService
{
    private readonly FleetDbContext _db;

    public DriverService(FleetDbContext db) => _db = db;

    public async Task<DriverDto?> GetAsync(int id)
    {
        return await _db.Drivers
            .AsNoTracking()
            .Where(d => d.Id == id)
            .Select(d => new DriverDto(d.Id, d.PersonnelNumber, d.DisplayName, d.Phone,
                d.Permits.Select(p => new PermitDto(p.Class, p.ValidUntil)).ToList()))
            .FirstOrDefaultAsync();
    }

    public async Task RenameAsync(int id, string displayName)
    {
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new KeyNotFoundException();
        driver.DisplayName = displayName.Trim();
        await _db.SaveChangesAsync();
    }

    // Отдел кадров присылает актуальный список допусков водителя целиком.
    public async Task ReplacePermitsAsync(int driverId, IReadOnlyList<PermitDto> permits)
    {
        var driver = await _db.Drivers
            .Include(d => d.Permits)
            .FirstOrDefaultAsync(d => d.Id == driverId)
            ?? throw new KeyNotFoundException();

        driver.Permits.Clear();
        foreach (var p in permits.DistinctBy(p => p.Class))
            driver.Permits.Add(new DriverPermit { Class = p.Class, ValidUntil = p.ValidUntil });

        await _db.SaveChangesAsync();
    }
}
