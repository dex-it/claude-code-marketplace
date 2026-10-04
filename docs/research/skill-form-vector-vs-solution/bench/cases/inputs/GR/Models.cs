namespace Motorpool.Fleet;

public enum VehicleClass { Car, Van, Truck }

public class Vehicle
{
    public int Id { get; set; }
    public string PlateNumber { get; set; } = "";
    public string Model { get; set; } = "";
    public VehicleClass Class { get; set; }
    public DateTime? DecommissionedAt { get; set; }
    public List<VehicleEquipment> Equipment { get; set; } = new();
}

// Оснащение машины: аптечка, огнетушитель, знак аварийной остановки, буксировочный трос...
public class VehicleEquipment
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public string Code { get; set; } = "";
    public int Qty { get; set; }
}

public class Driver
{
    public int Id { get; set; }
    public string PersonnelNumber { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Phone { get; set; } = "";
    public List<DriverPermit> Permits { get; set; } = new();
}

// Допуск водителя к классу техники (после инструктажа / медкомиссии).
public class DriverPermit
{
    public int Id { get; set; }
    public int DriverId { get; set; }
    public Driver Driver { get; set; } = null!;
    public VehicleClass Class { get; set; }
    public DateOnly ValidUntil { get; set; }
}

// Предрейсовый осмотр машины механиком.
public class Inspection
{
    public long Id { get; set; }
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public string MechanicName { get; set; } = "";
    public DateTime InspectedAt { get; set; }    // время осмотра по планшету, UTC
    public DateTime CreatedAt { get; set; }      // время приёма сервером
    public List<InspectionDefect> Defects { get; set; } = new();
}

public class InspectionDefect
{
    public long Id { get; set; }
    public long InspectionId { get; set; }
    public Inspection Inspection { get; set; } = null!;
    public string Description { get; set; } = "";
    public bool Blocking { get; set; }           // с таким замечанием машину на линию не выпускают
}

public class Trip
{
    public long Id { get; set; }
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public int DriverId { get; set; }
    public Driver Driver { get; set; } = null!;
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public int StartOdometerKm { get; set; }
    public int? EndOdometerKm { get; set; }
    public string Route { get; set; } = "";
    public string Purpose { get; set; } = "";
}
