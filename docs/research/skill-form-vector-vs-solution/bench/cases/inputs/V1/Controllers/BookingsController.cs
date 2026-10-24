using System.Linq.Expressions;
using System.Security.Claims;
using BerthBook.Contracts;
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
        b.PaidAmount);

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

        if (!User.IsInRole(Roles.HarbourMaster))
            query = query.Where(b => b.OwnerId == userId);
        if (vesselId is not null)
            query = query.Where(b => b.VesselId == vesselId);

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
        return CreatedAtAction(nameof(Get), new { id = booking.Id },
            new CreatedBookingDto(booking.Id, booking.Total, booking.Deposit, result.PaymentUrl!));
    }

    [HttpPost("{id:guid}/extend")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Extend(Guid id, ExtendBookingRequest req, CancellationToken ct)
    {
        var result = await _service.ExtendAsync(id, CurrentUserId, req.NewDeparture, ct);
        return result.Status switch
        {
            ExtendStatus.NotFound => NotFound(),
            ExtendStatus.NotConfirmed => Conflict(new { error = "Продлить можно только подтверждённую бронь" }),
            ExtendStatus.InvalidDates => UnprocessableEntity(new { error = "Новая дата выезда должна быть позже текущей" }),
            ExtendStatus.TooLong => UnprocessableEntity(new { error = $"Онлайн можно забронировать не больше {CreateBookingRequest.MaxNights} ночей" }),
            ExtendStatus.Busy => Conflict(new { error = "Место занято на эти даты" }),
            _ => Ok(new { total = result.NewTotal }),
        };
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
}
