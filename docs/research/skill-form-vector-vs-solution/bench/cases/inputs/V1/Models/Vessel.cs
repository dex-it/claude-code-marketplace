namespace BerthBook.Models;

public class Vessel
{
    public int Id { get; set; }
    public string OwnerId { get; set; } = "";

    public string Name { get; set; } = "";

    /// <summary>Бортовой номер из судового билета.</summary>
    public string RegistrationNumber { get; set; } = "";

    public string HomePort { get; set; } = "";

    /// <summary>Длина наибольшая (LOA), м.</summary>
    public decimal LengthM { get; set; }

    /// <summary>Ширина наибольшая, м.</summary>
    public decimal BeamM { get; set; }

    public string SkipperName { get; set; } = "";

    /// <summary>Телефон шкипера для связи с диспетчером.</summary>
    public string SkipperPhone { get; set; } = "";

    /// <summary>Номер полиса страхования ответственности, если есть.</summary>
    public string? InsurancePolicyNo { get; set; }
}
