using BerthBook.Models;

namespace BerthBook.Contracts;

/// <summary>Карточка судна в реестре судов диспетчерской.</summary>
public sealed record VesselDto(
    int Id,
    string Name,
    string RegistrationNumber,
    string HomePort,
    decimal LengthM,
    decimal BeamM,
    string SkipperName,
    string SkipperPhone,
    string? InsurancePolicyNo)
{
    public static VesselDto From(Vessel v) => new(
        v.Id,
        v.Name,
        v.RegistrationNumber,
        v.HomePort,
        v.LengthM,
        v.BeamM,
        v.SkipperName,
        v.SkipperPhone,
        v.InsurancePolicyNo);
}
