namespace ConfReg.Models;

/// <summary>Организация-партнёр или организация участников. Id совпадает с claim "org_id".</summary>
public class Organization
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Inn { get; set; } = "";
    public string? Kpp { get; set; }
    public string LegalAddress { get; set; } = "";
}
