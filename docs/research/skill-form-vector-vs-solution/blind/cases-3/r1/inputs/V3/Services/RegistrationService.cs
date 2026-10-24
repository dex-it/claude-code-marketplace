using System.ComponentModel.DataAnnotations;
using ConfReg.Data;
using ConfReg.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ConfReg.Services;

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

public enum RegisterError
{
    None,
    TicketNotFound,
    AlreadyRegistered,
}

public sealed record RegisterResult(Registration? Registration, RegisterError Error);

public enum CancelStatus
{
    Cancelled,
    NotFound,
    Forbidden,
    AlreadyCancelled,
}

public sealed record CancelResult(CancelStatus Status, long RefundKopecks = 0);

public class RegistrationService
{
    private readonly ConfDbContext _db;
    private readonly PricingService _pricing;
    private readonly ILogger<RegistrationService> _logger;

    public RegistrationService(ConfDbContext db, PricingService pricing, ILogger<RegistrationService> logger)
    {
        _db = db;
        _pricing = pricing;
        _logger = logger;
    }

    public async Task<RegisterResult> RegisterAsync(
        int conferenceId, string userId, string? organizationId, RegisterRequest req, CancellationToken ct)
    {
        var ticket = await _db.TicketTypes
            .SingleOrDefaultAsync(t => t.Id == req.TicketTypeId && t.ConferenceId == conferenceId, ct);
        if (ticket is null)
            return new(null, RegisterError.TicketNotFound);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        PromoCode? promo = null;
        if (!string.IsNullOrWhiteSpace(req.PromoCode))
        {
            promo = await _pricing.FindPromoAsync(conferenceId, req.PromoCode, ct);
            if (promo is not null && !PricingService.IsUsable(promo, today))
                promo = null;
        }

        var price = PricingService.ApplyPromo(PricingService.BasePrice(ticket, today), promo);

        var registration = new Registration
        {
            ConferenceId = conferenceId,
            TicketTypeId = ticket.Id,
            UserId = userId,
            FullName = req.FullName,
            Email = req.Email,
            OrganizationId = organizationId,
            PromoCodeId = promo?.Id,
            PriceKopecks = price,
            Status = RegistrationStatus.PendingPayment,
            PassportNumber = req.PassportNumber,
            PassportCountry = req.PassportCountry,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Registrations.Add(registration);

        if (promo is not null)
            promo.UsedCount++;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return new(null, RegisterError.AlreadyRegistered);
        }

        _logger.LogInformation("Registration {RegistrationId} created: {@Request}", registration.Id, req);
        return new(registration, RegisterError.None);
    }

    public async Task<CancelResult> CancelAsync(int registrationId, string userId, bool isOrgAdmin, CancellationToken ct)
    {
        var reg = await _db.Registrations
            .Include(r => r.Conference)
            .Include(r => r.TicketType)
            .SingleOrDefaultAsync(r => r.Id == registrationId, ct);
        if (reg is null)
            return new(CancelStatus.NotFound);
        if (reg.UserId != userId && !isOrgAdmin)
            return new(CancelStatus.Forbidden);
        if (reg.Status == RegistrationStatus.Cancelled)
            return new(CancelStatus.AlreadyCancelled);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysLeft = reg.Conference.StartDate.DayNumber - today.DayNumber;
        var sharePercent = daysLeft >= 30 ? 100 : daysLeft >= 7 ? 50 : 0;

        long refund = reg.Status == RegistrationStatus.Paid
            ? reg.TicketType.PriceKopecks * sharePercent / 100
            : 0;

        reg.Status = RegistrationStatus.Cancelled;
        reg.CancelledAt = DateTime.UtcNow;
        reg.RefundedKopecks = refund;
        await _db.SaveChangesAsync(ct);

        return new(CancelStatus.Cancelled, refund);
    }
}
