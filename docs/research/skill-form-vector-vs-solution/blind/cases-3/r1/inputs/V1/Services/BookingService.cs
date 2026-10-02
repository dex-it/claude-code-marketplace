using BerthBook.Data;
using BerthBook.Models;
using Microsoft.EntityFrameworkCore;

namespace BerthBook.Services;

public sealed record CreateBookingRequest(
    int VesselId,
    int BerthId,
    DateOnly Arrival,
    DateOnly Departure,
    string ContactPhone);

public sealed record CreateBookingResult(Booking? Booking, string? PaymentUrl, string? Error);

public enum CancelStatus
{
    Cancelled,
    NotFound,
    AlreadyCancelled,
}

public sealed record CancelResult(CancelStatus Status, decimal Refunded = 0);

public class BookingService
{
    private static readonly TimeOnly CheckInTime = new(14, 0);
    private const int FreeCancellationHours = 48;

    private readonly MarinaDbContext _db;
    private readonly TariffCalculator _tariff;
    private readonly IPaymentGateway _payments;
    private readonly ILogger<BookingService> _logger;

    public BookingService(
        MarinaDbContext db,
        TariffCalculator tariff,
        IPaymentGateway payments,
        ILogger<BookingService> logger)
    {
        _db = db;
        _tariff = tariff;
        _payments = payments;
        _logger = logger;
    }

    public async Task<CreateBookingResult> CreateAsync(string userId, CreateBookingRequest req, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (req.Arrival < today || req.Departure <= req.Arrival)
            return new(null, null, "Некорректные даты стоянки");

        var vessel = await _db.Vessels
            .SingleOrDefaultAsync(v => v.Id == req.VesselId && v.OwnerId == userId, ct);
        if (vessel is null)
            return new(null, null, "Судно не найдено");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // Блокируем строку места: параллельные брони одного места проходят по очереди.
        var berth = await _db.Berths
            .FromSql($"""SELECT * FROM "Berths" WHERE "Id" = {req.BerthId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);
        if (berth is null)
            return new(null, null, "Место не найдено");
        if (vessel.LengthM > berth.MaxLengthM)
            return new(null, null, "Судно не помещается на это место");

        var busy = await _db.Bookings.AnyAsync(b =>
            b.BerthId == berth.Id &&
            b.Status != BookingStatus.Cancelled &&
            b.Arrival <= req.Departure &&
            b.Departure >= req.Arrival, ct);
        if (busy)
            return new(null, null, "Место занято на эти даты");

        var quote = _tariff.Calculate(berth, vessel, req.Arrival, req.Departure);

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            BerthId = berth.Id,
            VesselId = vessel.Id,
            OwnerId = userId,
            Arrival = req.Arrival,
            Departure = req.Departure,
            Total = quote.Total,
            Deposit = quote.Deposit,
            Status = BookingStatus.AwaitingDeposit,
            ContactPhone = req.ContactPhone,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var paymentUrl = await _payments.CreateDepositAsync(booking.Id, booking.Deposit, ct);
        return new(booking, paymentUrl, null);
    }

    public async Task<CancelResult> CancelAsync(Guid bookingId, string userId, bool isHarbourMaster, CancellationToken ct)
    {
        var booking = await _db.Bookings.SingleOrDefaultAsync(b => b.Id == bookingId, ct);
        if (booking is null || (booking.OwnerId != userId && !isHarbourMaster))
            return new(CancelStatus.NotFound);
        if (booking.Status == BookingStatus.Cancelled)
            return new(CancelStatus.AlreadyCancelled);

        var arrivalAt = booking.Arrival.ToDateTime(CheckInTime);
        var hoursLeft = (arrivalAt - DateTime.UtcNow).TotalHours;
        var refund = hoursLeft >= FreeCancellationHours ? booking.PaidAmount : 0m;

        if (refund > 0)
        {
            try
            {
                await _payments.RefundAsync(booking.Id, refund, ct);
            }
            catch (PaymentGatewayException ex)
            {
                _logger.LogError(ex, "Refund failed for booking {BookingId}", booking.Id);
            }
        }

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        booking.RefundedAmount = refund;
        await _db.SaveChangesAsync(ct);

        return new(CancelStatus.Cancelled, refund);
    }
}
