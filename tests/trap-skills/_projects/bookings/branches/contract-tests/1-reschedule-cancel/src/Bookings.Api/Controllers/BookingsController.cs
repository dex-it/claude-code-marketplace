using System.Globalization;
using System.Text;
using Bookings.Api.Auth;
using Bookings.Api.Contracts;
using Bookings.Api.Data;
using Bookings.Api.Domain;
using Bookings.Api.Validation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bookings.Api.Controllers;

[ApiController]
[Route("api/v1/bookings")]
public class BookingsController(BookingsDbContext db, TimeProvider clock) : ControllerBase
{
    private const int DefaultLimit = 20;

    [HttpGet]
    public async Task<ActionResult<CursorPageDto<BookingDto>>> List(
        string? roomId, DateTimeOffset? from, DateTimeOffset? to, int limit = DefaultLimit, string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        (DateTimeOffset StartsAt, Guid Id)? after = null;
        if (cursor is not null)
        {
            after = DecodeCursor(cursor);
            if (after is null)
                return this.ValidationErrors(new() { ["cursor"] = ["Неверный курсор."] });
        }

        var query = db.Bookings.AsNoTracking();
        if (roomId is not null)
            query = query.Where(b => b.RoomId == roomId);
        if (from is not null)
            query = query.Where(b => b.EndsAt > from.Value.ToUniversalTime());
        if (to is not null)
            query = query.Where(b => b.StartsAt < to.Value.ToUniversalTime());
        if (after is { } position)
            query = query.Where(b => b.StartsAt > position.StartsAt || (b.StartsAt == position.StartsAt && b.Id.CompareTo(position.Id) > 0));

        var bookings = await query
            .OrderBy(b => b.StartsAt)
            .ThenBy(b => b.Id)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var response = new CursorPageDto<BookingDto>();
        foreach (var booking in bookings.Take(limit))
        {
            response.Items ??= new List<BookingDto>();
            response.Items.Add(BookingDto.From(booking));
        }

        if (bookings.Count > limit && response.Items is { Count: > 0 } items)
            response.NextCursor = EncodeCursor(items[^1].StartsAt, items[^1].Id);

        return response;
    }

    [HttpPost]
    public async Task<ActionResult<BookingDto>> Create(CreateBookingRequest request, CancellationToken cancellationToken)
    {
        var errors = BookingRules.Validate(request, clock.GetUtcNow());
        if (errors.Count > 0)
            return this.ValidationErrors(errors);

        if (!await db.Rooms.AnyAsync(r => r.Id == request.RoomId, cancellationToken))
            return this.ProblemWithCode(StatusCodes.Status404NotFound, "room-not-found", "Комната не найдена.");

        var booking = new Booking(request.RoomId, request.Title, request.Comment, request.StartsAt, request.DurationMinutes, User.UserId(), clock.GetUtcNow());
        db.Bookings.Add(booking);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsOverlap(ex))
        {
            return Overlap();
        }

        return StatusCode(StatusCodes.Status201Created, BookingDto.From(booking));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var booking = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (booking is null)
            return BookingNotFound();

        return BookingDto.From(booking);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<BookingDto>> Reschedule(Guid id, RescheduleBookingRequest request, CancellationToken cancellationToken)
    {
        var errors = BookingRules.Validate(request, clock.GetUtcNow());
        if (errors.Count > 0)
            return this.ValidationErrors(errors);

        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (booking is null)
            return BookingNotFound();

        if (booking.Status == BookingStatus.Cancelled)
            return this.ProblemWithCode(StatusCodes.Status409Conflict, "booking-cancelled", "Бронь отменена, перенести её нельзя.");

        booking.Reschedule(request.StartsAt, request.DurationMinutes);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsOverlap(ex))
        {
            return Overlap();
        }

        return BookingDto.From(booking);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (booking is null)
            return BookingNotFound();

        if (booking.OwnerId != User.UserId() && !User.IsAdmin())
            return NotOwner();

        booking.Cancel();
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static bool IsOverlap(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.ExclusionViolation };

    private ConflictObjectResult Overlap() => Conflict(new { error = "overlap" });

    private ObjectResult BookingNotFound() =>
        this.ProblemWithCode(StatusCodes.Status404NotFound, "booking-not-found", "Бронь не найдена.");

    private ObjectResult NotOwner() =>
        this.ProblemWithCode(StatusCodes.Status403Forbidden, "not-owner", "Изменить бронь может только её владелец или администратор.");

    private static string EncodeCursor(DateTimeOffset startsAt, Guid id) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(
            $"{startsAt.UtcTicks.ToString(CultureInfo.InvariantCulture)}:{id:N}"));

    private static (DateTimeOffset StartsAt, Guid Id)? DecodeCursor(string cursor)
    {
        try
        {
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split(':');
            if (parts.Length == 2
                && long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
                && Guid.TryParseExact(parts[1], "N", out var id))
                return (new DateTimeOffset(ticks, TimeSpan.Zero), id);
        }
        catch (FormatException)
        {
        }
        catch (ArgumentOutOfRangeException)
        {
        }

        return null;
    }
}
