using BerthBook.Contracts;
using BerthBook.Data;
using BerthBook.Models;
using Microsoft.EntityFrameworkCore;

namespace BerthBook.Services;

public sealed record CreateBookingResult(Booking? Booking, string? PaymentUrl, string? Error)
{
    public static CreateBookingResult Fail(string error) => new(null, null, error);
}

public enum ExtendStatus
{
    Extended,
    NotFound,
    NotConfirmed,
    InvalidDates,
    TooLong,
    Busy,
}

public sealed record ExtendResult(ExtendStatus Status, decimal NewTotal = 0);

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
    private static readonly TimeSpan FreeCancellation = TimeSpan.FromHours(48);

    private readonly MarinaDbContext _db;
    private readonly TariffCalculator _tariff;
    private readonly IPaymentGateway _payments;
    private readonly MarinaClock _clock;

    public BookingService(
        MarinaDbContext db,
        TariffCalculator tariff,
        IPaymentGateway payments,
        MarinaClock clock)
    {
        _db = db;
        _tariff = tariff;
        _payments = payments;
        _clock = clock;
    }

    public async Task<CreateBookingResult> CreateAsync(string userId, CreateBookingRequest req, CancellationToken ct)
    {
        var vessel = await _db.Vessels.AsNoTracking()
            .SingleOrDefaultAsync(v => v.Id == req.VesselId && v.OwnerId == userId, ct);
        if (vessel is null)
            return CreateBookingResult.Fail("Судно не найдено");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var berth = await LockBerthAsync(req.BerthId, ct);
        if (berth is null)
            return CreateBookingResult.Fail("Место не найдено");

        var marina = await _db.Marinas.AsNoTracking().SingleAsync(m => m.Id == berth.MarinaId, ct);
        if (req.Arrival < _clock.Today(marina))
            return CreateBookingResult.Fail("Дата заезда уже прошла");

        if (vessel.LengthM > berth.MaxLengthM)
            return CreateBookingResult.Fail("Судно не помещается на это место");

        var now = DateTime.UtcNow;
        var busy = await _db.Bookings
            .Where(b => b.BerthId == berth.Id)
            .Where(BookingQueries.Occupying(now))
            .Where(BookingQueries.Overlaps(req.Arrival, req.Departure))
            .AnyAsync(ct);
        if (busy)
            return CreateBookingResult.Fail("Место занято на эти даты");

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
            CreatedAt = now,
        };
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var paymentUrl = await _payments.CreatePaymentAsync(
            booking.OrderRef,
            Money.ToKopecks(booking.Deposit),
            $"Депозит за место {berth.Code}, {booking.Arrival:dd.MM}–{booking.Departure:dd.MM}",
            ct);

        return new CreateBookingResult(booking, paymentUrl, null);
    }

    public async Task<ExtendResult> ExtendAsync(Guid bookingId, string userId, DateOnly newDeparture, CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var booking = await _db.Bookings
            .Include(b => b.Vessel)
            .Include(b => b.Berth).ThenInclude(b => b.SeasonalRates)
            .SingleOrDefaultAsync(b => b.Id == bookingId && b.OwnerId == userId, ct);
        if (booking is null)
            return new(ExtendStatus.NotFound);
        if (booking.Status != BookingStatus.Confirmed)
            return new(ExtendStatus.NotConfirmed);
        if (newDeparture <= booking.Departure)
            return new(ExtendStatus.InvalidDates);
        if (newDeparture.DayNumber - booking.Arrival.DayNumber > CreateBookingRequest.MaxNights)
            return new(ExtendStatus.TooLong);

        await LockBerthAsync(booking.BerthId, ct);

        var busy = await _db.Bookings
            .Where(b => b.BerthId == booking.BerthId && b.Id != booking.Id)
            .Where(BookingQueries.Occupying(DateTime.UtcNow))
            .Where(BookingQueries.Overlaps(booking.Departure, newDeparture))
            .AnyAsync(ct);
        if (busy)
            return new(ExtendStatus.Busy);

        var extra = _tariff.Calculate(booking.Berth, booking.Vessel, booking.Departure, newDeparture);
        booking.Total += extra.Total;
        booking.Departure = newDeparture;

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new(ExtendStatus.Extended, booking.Total);
    }

    public async Task<CancelResult> CancelAsync(Guid bookingId, string userId, bool isHarbourMaster, CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.Berth).ThenInclude(b => b.Marina)
            .SingleOrDefaultAsync(b => b.Id == bookingId, ct);
        if (booking is null || (booking.OwnerId != userId && !isHarbourMaster))
            return new(CancelStatus.NotFound);
        if (booking.Status == BookingStatus.Cancelled)
            return new(CancelStatus.AlreadyCancelled);

        var checkInUtc = _clock.ToUtc(booking.Berth.Marina, booking.Arrival, CheckInTime);
        var refund = checkInUtc - DateTime.UtcNow >= FreeCancellation ? booking.PaidAmount : 0m;

        // Возврат идемпотентен на стороне PayGate, поэтому при сбое сохранения повтор отмены безопасен.
        if (refund > 0)
            await _payments.RefundAsync(booking.OrderRef, Money.ToKopecks(refund), ct);

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        booking.RefundedAmount = refund;
        await _db.SaveChangesAsync(ct);

        return new(CancelStatus.Cancelled, refund);
    }

    /// <summary>Блокирует строку места до конца транзакции: брони одного места проходят по очереди.</summary>
    private Task<Berth?> LockBerthAsync(int berthId, CancellationToken ct) =>
        _db.Berths
            .FromSql($"""SELECT * FROM "Berths" WHERE "Id" = {berthId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);
}
