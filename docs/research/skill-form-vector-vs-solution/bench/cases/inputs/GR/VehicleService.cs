using Microsoft.EntityFrameworkCore;

namespace Motorpool.Fleet;

public record EquipmentDto(string Code, int Qty);

public record DefectDto(string Description, bool Blocking);

public record InspectionDto(int VehicleId, string Mechanic, DateTimeOffset InspectedAt, List<DefectDto> Defects);

public class VehicleService
{
    private readonly FleetDbContext _db;

    public VehicleService(FleetDbContext db) => _db = db;

    public Task<Vehicle?> FindVehicleAsync(int id) =>
        _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id);

    // Госномер вводят как придётся: "а 123 бв 77", "А123БВ77".
    public Task<Vehicle?> FindByPlateAsync(string plate) =>
        _db.Vehicles
            .FromSql($"SELECT * FROM vehicles WHERE upper(replace(plate_number, ' ', '')) = upper(replace({plate}, ' ', ''))")
            .Where(v => v.DecommissionedAt == null)
            .FirstOrDefaultAsync();

    public async Task DecommissionAsync(int id)
    {
        var vehicle = await FindVehicleAsync(id) ?? throw new KeyNotFoundException();
        vehicle.DecommissionedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // Механик присылает актуальную комплектацию машины целиком.
    public async Task ReplaceEquipmentAsync(int vehicleId, IReadOnlyList<EquipmentDto> items)
    {
        var vehicle = await FindVehicleAsync(vehicleId) ?? throw new KeyNotFoundException();

        vehicle.Equipment.Clear();
        foreach (var item in items.DistinctBy(i => i.Code))
            vehicle.Equipment.Add(new VehicleEquipment { Code = item.Code, Qty = item.Qty });

        await _db.SaveChangesAsync();
    }

    // Планшет механика копит осмотры без связи (бокс на территории без сети) и отправляет
    // их пачкой, когда появляется сеть. Повторный осмотр после устранения замечаний - отдельная запись.
    public async Task<int> SyncInspectionsAsync(IReadOnlyList<InspectionDto> batch)
    {
        foreach (var dto in batch)
        {
            _db.Inspections.Add(new Inspection
            {
                VehicleId = dto.VehicleId,
                MechanicName = dto.Mechanic,
                InspectedAt = dto.InspectedAt.UtcDateTime,
                Defects = dto.Defects
                    .Select(d => new InspectionDefect { Description = d.Description, Blocking = d.Blocking })
                    .ToList(),
            });
        }

        await _db.SaveChangesAsync();
        return batch.Count;
    }

    public Task<Inspection?> GetLastInspectionAsync(int vehicleId) =>
        _db.Inspections
            .AsNoTracking()
            .Include(i => i.Defects)
            .Where(i => i.VehicleId == vehicleId)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefaultAsync();
}
