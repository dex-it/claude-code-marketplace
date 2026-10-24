namespace VetClinic.Records.Domain;

public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}

public class Owner : ISoftDeletable
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public List<Pet> Pets { get; set; } = new();
}

public class Pet : ISoftDeletable
{
    public int Id { get; set; }
    public int OwnerId { get; set; }
    public Owner Owner { get; set; } = null!;

    public string Name { get; set; } = "";
    public string Species { get; set; } = "";
    public DateOnly BirthDate { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public List<Allergy> Allergies { get; set; } = new();
    public List<Visit> Visits { get; set; } = new();
}

public enum AllergySeverity
{
    Mild = 1,
    Moderate = 2,
    Severe = 3
}

public class Allergy : ISoftDeletable
{
    public int Id { get; set; }
    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string Allergen { get; set; } = "";
    public string? Reaction { get; set; }
    public AllergySeverity Severity { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public enum VisitStatus
{
    Planned = 1,
    Completed = 2,
    Cancelled = 3
}

public class Visit : ISoftDeletable
{
    public int Id { get; set; }
    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string VetName { get; set; } = "";
    public DateTime ScheduledAt { get; set; }
    public VisitStatus Status { get; set; }
    public string? Notes { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
