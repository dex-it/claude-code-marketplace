namespace VetClinic.Procedures.Domain;

public enum ProcedureStatus
{
    Scheduled = 1,
    InProgress = 2,
    Closed = 3,
    Cancelled = 4
}

public class Procedure
{
    public int Id { get; set; }

    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string Title { get; set; } = "";

    // Время по настенным часам кабинета (см. README), без пояса.
    public DateTime ScheduledLocal { get; set; }
    public int DurationMinutes { get; set; }

    public ProcedureStatus Status { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<ConsumableLine> Consumables { get; set; } = new();
    public List<StaffNote> StaffNotes { get; set; } = new();
}

public class ConsumableLine
{
    public int Id { get; set; }
    public int ProcedureId { get; set; }
    public Procedure Procedure { get; set; } = null!;

    public string Item { get; set; } = "";
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "";
}

public class StaffNote
{
    public int Id { get; set; }
    public int ProcedureId { get; set; }
    public Procedure Procedure { get; set; } = null!;

    public string Author { get; set; } = "";
    public string Text { get; set; } = "";
    public DateTime WrittenAt { get; set; }
}
