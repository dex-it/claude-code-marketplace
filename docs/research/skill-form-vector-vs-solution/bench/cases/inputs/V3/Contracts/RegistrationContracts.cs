using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using ConfReg.Models;

namespace ConfReg.Contracts;

public sealed class RegisterRequest
{
    public int TicketTypeId { get; set; }

    [Required, MaxLength(200)]
    public string FullName { get; set; } = "";

    [Required, EmailAddress, MaxLength(200)]
    public string Email { get; set; } = "";

    [MaxLength(32)]
    public string? PromoCode { get; set; }

    /// <summary>Только для иностранных участников - для визового приглашения.</summary>
    [MaxLength(32)]
    public string? PassportNumber { get; set; }

    [StringLength(2, MinimumLength = 2)]
    public string? PassportCountry { get; set; }
}

public sealed record RegisteredDto(int Id, long PriceKopecks);

public sealed class GroupOrderRequest
{
    public int TicketTypeId { get; set; }

    [Range(1, 500)]
    public int Quantity { get; set; }
}

public sealed record GroupOrderDto(int Id, int TicketTypeId, int Quantity, long AmountKopecks, string InvoiceNumber, int SeatsUsed);

public sealed class AddParticipantRequest
{
    [Required, MaxLength(200)]
    public string FullName { get; set; } = "";

    [Required, EmailAddress, MaxLength(200)]
    public string Email { get; set; } = "";
}

/// <summary>Строка списка участников конференции.</summary>
public sealed record ParticipantDto(
    int RegistrationId,
    string FullName,
    string Email,
    string TicketType,
    RegistrationStatus Status,
    string? OrganizationId,
    string? PassportNumber,
    string? PassportCountry)
{
    public static readonly Expression<Func<Registration, ParticipantDto>> Projection = r => new ParticipantDto(
        r.Id,
        r.FullName,
        r.Email,
        r.TicketType.Name,
        r.Status,
        r.OrganizationId,
        r.PassportNumber,
        r.PassportCountry);
}
