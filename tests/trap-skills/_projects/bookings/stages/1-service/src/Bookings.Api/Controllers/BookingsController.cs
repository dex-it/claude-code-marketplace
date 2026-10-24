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
    [HttpPost]
    public async Task<ActionResult<BookingDto>> Create(CreateBookingRequest request, CancellationToken cancellationToken)
    {
        var errors = BookingRules.Validate(request, clock.GetUtcNow());
        if (errors.Count > 0)
            return this.ValidationErrors(errors);

        if (!await db.Rooms.AnyAsync(r => r.Id == request.RoomId, cancellationToken))
            return this.ProblemWithCode(StatusCodes.Status404NotFound, "room-not-found", "Комната не найдена.");

        var booking = new Booking(request.RoomId, request.Title, request.Comment, request.StartsAt, request.DurationMinutes, User.UserId());
        db.Bookings.Add(booking);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsOverlap(ex))
        {
            return Overlap();
        }

        return CreatedAtAction(nameof(Get), new { id = booking.Id }, BookingDto.From(booking));
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

        if (booking.OwnerId != User.UserId() && !User.IsAdmin())
            return NotOwner();

        if (booking.Version != request.Version)
            return VersionConflict();

        if (booking.Status == BookingStatus.Cancelled)
            return this.ProblemWithCode(StatusCodes.Status409Conflict, "booking-cancelled", "Бронь отменена, перенести её нельзя.");

        booking.Reschedule(request.StartsAt, request.DurationMinutes);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return VersionConflict();
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

    private ObjectResult Overlap() =>
        this.ProblemWithCode(StatusCodes.Status409Conflict, "booking-overlap", "Комната на это время уже занята.");

    private ObjectResult BookingNotFound() =>
        this.ProblemWithCode(StatusCodes.Status404NotFound, "booking-not-found", "Бронь не найдена.");

    private ObjectResult NotOwner() =>
        this.ProblemWithCode(StatusCodes.Status403Forbidden, "not-owner", "Изменить бронь может только её владелец или администратор.");

    private ObjectResult VersionConflict() =>
        this.ProblemWithCode(StatusCodes.Status409Conflict, "version-conflict", "Бронь изменилась, обновите её и повторите.");
}
