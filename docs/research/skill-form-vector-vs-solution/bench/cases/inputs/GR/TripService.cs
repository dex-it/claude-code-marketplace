using Microsoft.EntityFrameworkCore;
using Motorpool.Fleet.Infrastructure;

namespace Motorpool.Fleet;

public sealed class TripRow
{
    public long Id { get; init; }
    public string Plate { get; init; } = "";
    public string Driver { get; init; } = "";
    public DateTime StartedAt { get; init; }
    public DateTime? FinishedAt { get; init; }
    public int Km { get; init; }
    public string Route { get; init; } = "";
    public string Purpose { get; init; } = "";
    public bool OffDay { get; init; }
}

public static class TripRows
{
    public static IQueryable<TripRow> ToRows(this IQueryable<Trip> trips) =>
        trips.Select(t => new TripRow
        {
            Id = t.Id,
            Plate = t.Vehicle.PlateNumber,
            Driver = t.Driver.DisplayName,
            StartedAt = t.StartedAt,
            FinishedAt = t.FinishedAt,
            Km = t.EndOdometerKm == null ? 0 : t.EndOdometerKm.Value - t.StartOdometerKm,
            Route = t.Route,
            Purpose = t.Purpose,
            OffDay = !WorkCalendar.IsWorkingDay(t.StartedAt),
        });
}

public record StartTripRequest(int VehicleId, int DriverId, int OdometerKm, string Route, string Purpose);

public class TripDeniedException(string message) : InvalidOperationException(message);

public class TripService
{
    private readonly FleetDbContext _db;
    private readonly VehicleService _vehicles;

    public TripService(FleetDbContext db, VehicleService vehicles)
    {
        _db = db;
        _vehicles = vehicles;
    }

    // Поездки машины за период (даты - московские).
    public async Task<List<TripRow>> GetVehicleTripsAsync(int vehicleId, DateOnly from, DateOnly to)
    {
        var fromUtc = MoscowDayStartUtc(from);
        var toUtc = MoscowDayStartUtc(to.AddDays(1));

        return await _db.Trips
            .AsNoTracking()
            .Where(t => t.VehicleId == vehicleId && t.StartedAt >= fromUtc && t.StartedAt < toUtc)
            .OrderBy(t => t.StartedAt)
            .ToRows()
            .ToListAsync();
    }

    // FLEET-109: поездки в выходные и праздники за месяц, самые длинные сверху.
    public async Task<List<TripRow>> OffDayTripsAsync(int year, int month)
    {
        var first = new DateOnly(year, month, 1);
        var fromUtc = MoscowDayStartUtc(first);
        var toUtc = MoscowDayStartUtc(first.AddMonths(1));

        return await _db.Trips
            .AsNoTracking()
            .Where(t => t.StartedAt >= fromUtc && t.StartedAt < toUtc)
            .ToRows()
            .Where(r => r.OffDay)
            .OrderByDescending(r => r.Km)
            .ToListAsync();
    }

    // FLEET-112: путевые листы, не закрытые больше суток. Запрос взят из дашборда диспетчерской.
    public async Task<List<Trip>> GetOpenWaybillsAsync(int? vehicleId)
    {
        var query = _db.Trips.FromSqlRaw("""
            SELECT t.*
            FROM trips t
            WHERE t.finished_at IS NULL
              AND t.started_at < now() - interval '24 hours'
            ORDER BY t.started_at;
            """);

        if (vehicleId is { } id)
            query = query.Where(t => t.VehicleId == id);

        return await query.AsNoTracking().ToListAsync();
    }

    // FLEET-107: выпуск на линию.
    public async Task<long> StartTripAsync(StartTripRequest req)
    {
        var vehicle = await _db.Vehicles
            .FirstOrDefaultAsync(v => v.Id == req.VehicleId && v.DecommissionedAt == null)
            ?? throw new KeyNotFoundException("Машина не найдена");

        var driver = await _db.Drivers
            .Include(d => d.Permits)
            .FirstOrDefaultAsync(d => d.Id == req.DriverId)
            ?? throw new KeyNotFoundException("Водитель не найден");

        var today = WorkCalendar.MoscowDate(DateTime.UtcNow);
        if (!driver.Permits.Any(p => p.Class == vehicle.Class && p.ValidUntil > today))
            throw new TripDeniedException("Нет действующего допуска к классу машины");

        var inspection = await _vehicles.GetLastInspectionAsync(vehicle.Id);
        if (inspection is null
            || inspection.InspectedAt < DateTime.UtcNow.AddHours(-12)
            || inspection.Defects.Any(d => d.Blocking))
            throw new TripDeniedException("Нет актуального осмотра без блокирующих замечаний");

        var trip = new Trip
        {
            VehicleId = vehicle.Id,
            DriverId = driver.Id,
            StartedAt = DateTime.UtcNow,
            StartOdometerKm = req.OdometerKm,
            Route = req.Route,
            Purpose = req.Purpose,
        };
        _db.Trips.Add(trip);
        await _db.SaveChangesAsync();
        return trip.Id;
    }

    private static DateTime MoscowDayStartUtc(DateOnly day) =>
        TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), WorkCalendar.Moscow);
}
