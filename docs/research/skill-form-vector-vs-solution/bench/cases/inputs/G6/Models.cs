namespace Domovoy.Housing;

public enum RequestStatus { New, Assigned, InProgress, Done, Rejected }

public class House
{
    public int Id { get; set; }
    public string Address { get; set; } = "";       // "ул. Ленина, 5"
    public string District { get; set; } = "";
    public List<Apartment> Apartments { get; set; } = new();
}

public class Apartment
{
    public int Id { get; set; }
    public int HouseId { get; set; }
    public House House { get; set; } = null!;
    public string Number { get; set; } = "";
}

public class ServiceRequest
{
    public int Id { get; set; }
    public int ApartmentId { get; set; }
    public Apartment Apartment { get; set; } = null!;
    public string Text { get; set; } = "";
    public string Category { get; set; } = "";
    public RequestStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
}

// План планово-предупредительных работ по дому.
public class MaintenancePlan
{
    public int Id { get; set; }
    public int HouseId { get; set; }
    public House House { get; set; } = null!;
    public List<PlanItem> Items { get; set; } = new();
}

public class PlanItem
{
    public int Id { get; set; }
    public int PlanId { get; set; }
    public MaintenancePlan Plan { get; set; } = null!;
    public string WorkCode { get; set; } = "";      // код работы по классификатору: "ROOF-INSP", "VENT-CLEAN"...
    public string Title { get; set; } = "";
    public int PeriodDays { get; set; }
    public List<PlanItemCompletion> Completions { get; set; } = new();
}

// Отметка о выполнении работы: дата, подрядчик, номер акта.
public class PlanItemCompletion
{
    public int Id { get; set; }
    public int PlanItemId { get; set; }
    public PlanItem PlanItem { get; set; } = null!;
    public DateOnly DoneOn { get; set; }
    public string Contractor { get; set; } = "";
    public string ActNumber { get; set; } = "";
}
