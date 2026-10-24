namespace VetClinic.Journal.Domain;

public class Pet
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Species { get; set; } = "";
}

public class Vet
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
}

public enum VisitStatus
{
    Planned = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}

public class Visit
{
    public int Id { get; set; }

    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public int VetId { get; set; }
    public Vet Vet { get; set; } = null!;

    // Начало слота расписания (UTC), шаг 15 минут. Питомец может быть записан в один и тот же слот
    // к нескольким врачам (совместный приём терапевта и узкого специалиста) - это нормально.
    public DateTime SlotStart { get; set; }

    public VisitStatus Status { get; set; }
    public string Complaint { get; set; } = "";
    public string? Diagnosis { get; set; }

    public List<LabResult> LabResults { get; set; } = new();
    public List<Prescription> Prescriptions { get; set; } = new();
}

public class LabResult
{
    public int Id { get; set; }
    public int VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    public string TestCode { get; set; } = "";
    public decimal Value { get; set; }
    public string Unit { get; set; } = "";
    public DateTime TakenAt { get; set; }
}

public class Prescription
{
    public int Id { get; set; }
    public int VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    public string Drug { get; set; } = "";
    public string Dosage { get; set; } = "";
    public int Days { get; set; }
}
