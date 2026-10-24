namespace VetClinic.Procedures.Domain;

public class Pet
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Species { get; set; } = "";

    public string? ChipNumber { get; set; }
    public int WeightGrams { get; set; }
}
