using ConfReg.Contracts;
using ConfReg.Data;
using ConfReg.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ConfReg.Services;

public enum RegisterError
{
    None,
    TicketNotFound,
    InvalidPromo,
    SoldOut,
    AlreadyRegistered,
}

public sealed record RegisterResult(Registration? Registration, RegisterError Error, string? Reason = null);

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
    private readonly CapacityService _capacity;
    private readonly ILogger<RegistrationService> _logger;

    public RegistrationService(
        ConfDbContext db,
        PricingService pricing,
        CapacityService capacity,
        ILogger<RegistrationService> logger)
    {
        _db = db;
        _pricing = pricing;
        _capacity = capacity;
        _logger = logger;
    }

    public async Task<RegisterResult> RegisterAsync(
        int conferenceId, string userId, string? organizationId, RegisterRequest req, CancellationToken ct)
    {
        var ticket = await _db.TicketTypes.AsNoTracking()
            .SingleOrDefaultAsync(t => t.Id == req.TicketTypeId && t.ConferenceId == conferenceId, ct);
        if (ticket is null)
            return new(null, RegisterError.TicketNotFound);

        var today = PricingService.Today();

        PromoCode? promo = null;
        if (!string.IsNullOrWhiteSpace(req.PromoCode))
        {
            promo = await _pricing.FindPromoAsync(conferenceId, req.PromoCode, ct);
            if (promo is null)
                return new(null, RegisterError.InvalidPromo, "Промокод не найден");

            var why = PricingService.WhyUnusable(promo, today);
            if (why is not null)
                return new(null, RegisterError.InvalidPromo, why);
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var conference = await _capacity.LockConferenceAsync(conferenceId, ct);
        if (conference is null)
            return new(null, RegisterError.TicketNotFound);
        if (await _capacity.FreeSeatsAsync(conference, ct) == 0)
            return new(null, RegisterError.SoldOut, "Все места на конференцию проданы");

        var registration = new Registration
        {
            ConferenceId = conferenceId,
            TicketTypeId = ticket.Id,
            UserId = userId,
            FullName = req.FullName,
            Email = req.Email,
            OrganizationId = organizationId,
            PromoCodeId = promo?.Id,
            PriceKopecks = PricingService.Quote(ticket, promo, today),
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

        await tx.CommitAsync(ct);

        _logger.LogInformation(
            "Registration {RegistrationId} created: conference {ConferenceId}, ticket {TicketTypeId}, promo {PromoCodeId}",
            registration.Id, conferenceId, ticket.Id, promo?.Id);

        return new(registration, RegisterError.None);
    }

    public async Task<CancelResult> CancelAsync(
        int registrationId, string userId, bool isOrgAdmin, string? orgId, CancellationToken ct)
    {
        var reg = await _db.Registrations
            .Include(r => r.Conference)
            .SingleOrDefaultAsync(r => r.Id == registrationId, ct);
        if (reg is null)
            return new(CancelStatus.NotFound);

        var isOwner = reg.UserId is not null && reg.UserId == userId;
        var isAdminOfOrg = isOrgAdmin && orgId is not null && reg.OrganizationId == orgId;
        if (!isOwner && !isAdminOfOrg)
            return new(CancelStatus.Forbidden);
        if (reg.Status == RegistrationStatus.Cancelled)
            return new(CancelStatus.AlreadyCancelled);

        var daysLeft = reg.Conference.StartDate.DayNumber - PricingService.Today().DayNumber;
        var sharePercent = daysLeft >= 30 ? 100 : daysLeft >= 7 ? 50 : 0;

        // Места из групповых заказов оплачены счётом организации, возвраты по ним - по договору.
        long refund = reg.GroupOrderId is null && reg.Status == RegistrationStatus.Paid
            ? reg.PriceKopecks * sharePercent / 100
            : 0;

        reg.Status = RegistrationStatus.Cancelled;
        reg.CancelledAt = DateTime.UtcNow;
        reg.RefundedKopecks = refund;
        await _db.SaveChangesAsync(ct);

        return new(CancelStatus.Cancelled, refund);
    }
}
