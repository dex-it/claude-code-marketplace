namespace VetClinic.Hospital.Domain;

public class Box
{
    public int Id { get; set; }
    public string Code { get; set; } = "";      // «И-3», уникален
    public string Ward { get; set; } = "";      // infection | surgery | therapy
    public int Capacity { get; set; }
    public decimal DailyRate { get; set; }

    public bool IsDecommissioned { get; set; }
    public DateTime? DecommissionedAt { get; set; }

    public List<Stay> Stays { get; set; } = new();
}

public class Stay
{
    public int Id { get; set; }

    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public int BoxId { get; set; }
    public Box Box { get; set; } = null!;

    // Дата поступления по журналу приёмного отделения (без времени).
    // Повторная госпитализация в тот же день бывает: выписали утром - вернули вечером.
    public DateOnly AdmittedOn { get; set; }
    public DateOnly? DischargedOn { get; set; }

    public string Reason { get; set; } = "";
    public decimal? TotalCost { get; set; }

    public List<MedicationOrder> MedicationOrders { get; set; } = new();
    public List<Observation> Observations { get; set; } = new();

    public int DaysInWard =>
        (DischargedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).DayNumber - AdmittedOn.DayNumber;
}

public class MedicationOrder
{
    public int Id { get; set; }
    public int StayId { get; set; }
    public Stay Stay { get; set; } = null!;

    public string Drug { get; set; } = "";
    public decimal DoseMg { get; set; }
    public string Route { get; set; } = "";     // po | iv | im | sc
    public int TimesPerDay { get; set; }

    public DateTime? CancelledAt { get; set; }
}

public class Observation
{
    public int Id { get; set; }
    public int StayId { get; set; }
    public Stay Stay { get; set; } = null!;

    public DateTime TakenAt { get; set; }
    public decimal TemperatureC { get; set; }
    public int HeartRate { get; set; }
    public string? Note { get; set; }
}
