using System.Linq.Expressions;
using System.Security.Claims;
using BerthBook.Data;
using BerthBook.Models;
using BerthBook.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BerthBook.Controllers;

public static class Roles
{
    public const string Owner = "Owner";
    public const string HarbourMaster = "HarbourMaster";
}

public sealed record BookingDto(
    Guid Id,
    string BerthCode,
    string VesselName,
    DateOnly Arrival,
    DateOnly Departure,
    BookingStatus Status,
    decimal Total,
    decimal Deposit,
    decimal PaidAmount,
    string ContactPhone);

[ApiController]
[Route("api/bookings")]
[Authorize(Roles = Roles.Owner + "," + Roles.HarbourMaster)]
public class BookingsController : ControllerBase
{
    private static readonly Expression<Func<Booking, BookingDto>> ToDto = b => new BookingDto(
        b.Id,
        b.Berth.Code,
        b.Vessel.Name,
        b.Arrival,
        b.Departure,
        b.Status,
        b.Total,
        b.Deposit,
        b.PaidAmount,
        b.ContactPhone);

    private readonly MarinaDbContext _db;
    private readonly BookingService _service;

    public BookingsController(MarinaDbContext db, BookingService service)
    {
        _db = db;
        _service = service;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<List<BookingDto>>> List([FromQuery] int? vesselId, CancellationToken ct)
    {
        var userId = CurrentUserId;
        var query = _db.Bookings.AsNoTracking();

        if (vesselId is not null)
            query = query.Where(b => b.VesselId == vesselId);
        else if (!User.IsInRole(Roles.HarbourMaster))
            query = query.Where(b => b.OwnerId == userId);

        return await query
            .OrderByDescending(b => b.Arrival)
            .Select(ToDto)
            .ToListAsync(ct);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingDto>> Get(Guid id, CancellationToken ct)
    {
        var userId = CurrentUserId;
        var isHarbourMaster = User.IsInRole(Roles.HarbourMaster);

        var dto = await _db.Bookings.AsNoTracking()
            .Where(b => b.Id == id && (isHarbourMaster || b.OwnerId == userId))
            .Select(ToDto)
            .SingleOrDefaultAsync(ct);

        return dto is null ? NotFound() : dto;
    }

    [HttpPost]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Create(CreateBookingRequest req, CancellationToken ct)
    {
        var result = await _service.CreateAsync(CurrentUserId, req, ct);
        if (result.Error is not null)
            return UnprocessableEntity(new { error = result.Error });

        var booking = result.Booking!;
        return CreatedAtAction(nameof(Get), new { id = booking.Id }, new
        {
            booking.Id,
            booking.Total,
            booking.Deposit,
            result.PaymentUrl,
        });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await _service.CancelAsync(id, CurrentUserId, User.IsInRole(Roles.HarbourMaster), ct);
        return result.Status switch
        {
            CancelStatus.NotFound => NotFound(),
            CancelStatus.AlreadyCancelled => Conflict(new { error = "Бронь уже отменена" }),
            _ => Ok(new { refunded = result.Refunded }),
        };
    }

    [AllowAnonymous]
    [HttpGet("/api/berths/{berthId:int}/calendar")]
    public async Task<ActionResult<List<BookingDto>>> Calendar(
        int berthId,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        return await _db.Bookings.AsNoTracking()
            .Where(b => b.BerthId == berthId
                        && b.Status != BookingStatus.Cancelled
                        && b.Arrival < to
                        && b.Departure > from)
            .OrderBy(b => b.Arrival)
            .Select(ToDto)
            .ToListAsync(ct);
    }
}
