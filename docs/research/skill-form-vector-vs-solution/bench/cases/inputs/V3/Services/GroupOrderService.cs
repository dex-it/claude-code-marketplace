using ConfReg.Contracts;
using ConfReg.Data;
using ConfReg.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ConfReg.Services;

public enum GroupOrderError
{
    None,
    NotFound,
    SoldOut,
    NoSeatsLeft,
}

public sealed record GroupOrderResult(GroupOrder? Order, GroupOrderError Error, bool Replayed = false);

public sealed record AddParticipantResult(Registration? Registration, GroupOrderError Error);

public class GroupOrderService
{
    private readonly ConfDbContext _db;
    private readonly CapacityService _capacity;
    private readonly IBillingClient _billing;

    public GroupOrderService(ConfDbContext db, CapacityService capacity, IBillingClient billing)
    {
        _db = db;
        _capacity = capacity;
        _billing = billing;
    }

    public async Task<GroupOrderResult> CreateAsync(
        int conferenceId, string orgId, string userId, string idempotencyKey, GroupOrderRequest req, CancellationToken ct)
    {
        var existing = await FindByKeyAsync(conferenceId, orgId, idempotencyKey, ct);
        if (existing is not null)
            return new(existing, GroupOrderError.None, Replayed: true);

        var ticket = await _db.TicketTypes.AsNoTracking()
            .SingleOrDefaultAsync(t => t.Id == req.TicketTypeId && t.ConferenceId == conferenceId, ct);
        var org = await _db.Organizations.AsNoTracking()
            .SingleOrDefaultAsync(o => o.Id == orgId, ct);
        if (ticket is null || org is null)
            return new(null, GroupOrderError.NotFound);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var conference = await _capacity.LockConferenceAsync(conferenceId, ct);
        if (conference is null)
            return new(null, GroupOrderError.NotFound);
        if (await _capacity.FreeSeatsAsync(conference, ct) < req.Quantity)
            return new(null, GroupOrderError.SoldOut);

        long unitPrice = PricingService.BasePrice(ticket, PricingService.Today());
        var invoice = InvoiceBuilder.ForGroupOrder(org, conference, ticket, req.Quantity, unitPrice);
        var invoiceNumber = await _billing.CreateInvoiceAsync(invoice, ct);

        var order = new GroupOrder
        {
            ConferenceId = conferenceId,
            OrganizationId = orgId,
            TicketTypeId = ticket.Id,
            Quantity = req.Quantity,
            UnitPriceKopecks = unitPrice,
            AmountKopecks = invoice.TotalKopecks,
            IdempotencyKey = idempotencyKey,
            InvoiceNumber = invoiceNumber,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };
        _db.GroupOrders.Add(order);

        try
        {
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Параллельный повтор с тем же ключом успел раньше - отдаём его заказ.
            await tx.RollbackAsync(ct);
            _db.Entry(order).State = EntityState.Detached;
            var winner = await FindByKeyAsync(conferenceId, orgId, idempotencyKey, ct);
            return new(winner, GroupOrderError.None, Replayed: true);
        }

        return new(order, GroupOrderError.None);
    }

    public async Task<AddParticipantResult> AddParticipantAsync(
        int conferenceId, int orderId, string orgId, AddParticipantRequest req, CancellationToken ct)
    {
        var order = await _db.GroupOrders
            .Include(o => o.Participants)
            .SingleOrDefaultAsync(o => o.Id == orderId && o.ConferenceId == conferenceId && o.OrganizationId == orgId, ct);
        if (order is null)
            return new(null, GroupOrderError.NotFound);

        if (order.Participants.Count >= order.Quantity)
            return new(null, GroupOrderError.NoSeatsLeft);

        var registration = new Registration
        {
            ConferenceId = conferenceId,
            TicketTypeId = order.TicketTypeId,
            FullName = req.FullName,
            Email = req.Email,
            OrganizationId = orgId,
            PriceKopecks = order.UnitPriceKopecks,
            Status = RegistrationStatus.PendingPayment,
            CreatedAt = DateTime.UtcNow,
        };
        order.Participants.Add(registration);

        await _db.SaveChangesAsync(ct);
        return new(registration, GroupOrderError.None);
    }

    private Task<GroupOrder?> FindByKeyAsync(int conferenceId, string orgId, string key, CancellationToken ct) =>
        _db.GroupOrders.AsNoTracking()
            .SingleOrDefaultAsync(o => o.ConferenceId == conferenceId
                                       && o.OrganizationId == orgId
                                       && o.IdempotencyKey == key, ct);
}
