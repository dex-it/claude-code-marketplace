namespace VetClinic.Reception.Domain;

public enum Species
{
    Dog = 1,
    Cat = 2,
    Ferret = 3,
    Rabbit = 4,
    Other = 99
}

public class Owner
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";

    // Только цифры, 11 знаков, начинается с 7 - приводится PhoneFormat.Normalize при сохранении.
    // Номер не уникален: на один телефон часто записаны несколько членов семьи.
    public string Phone { get; set; } = "";

    public string? Email { get; set; }

    public bool SmsConsent { get; set; }
    public DateTime? SmsConsentChangedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<Pet> Pets { get; set; } = new();
}

public class Pet
{
    public int Id { get; set; }
    public int OwnerId { get; set; }
    public Owner Owner { get; set; } = null!;

    public string Name { get; set; } = "";
    public Species Species { get; set; }
    public DateOnly BirthDate { get; set; }

    public List<Vaccination> Vaccinations { get; set; } = new();

    public int AgeYears
    {
        get
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var age = today.Year - BirthDate.Year;
            if (BirthDate > today.AddYears(-age))
                age--;
            return age;
        }
    }

    // Правило клиники: с какого возраста питомец считается возрастным
    // (для возрастных действует своя программа напоминаний).
    public bool IsSenior => Species switch
    {
        Species.Dog => AgeYears >= 8,
        Species.Cat => AgeYears >= 10,
        Species.Ferret => AgeYears >= 5,
        Species.Rabbit => AgeYears >= 6,
        _ => false
    };
}

public class Vaccination
{
    public int Id { get; set; }
    public int PetId { get; set; }
    public Pet Pet { get; set; } = null!;

    public string VaccineCode { get; set; } = "";   // см. VaccineCodes
    public DateTime AdministeredAt { get; set; }
}

public static class VaccineCodes
{
    public const string Rabies = "RABIES";
    public const string Complex = "COMPLEX";
}
