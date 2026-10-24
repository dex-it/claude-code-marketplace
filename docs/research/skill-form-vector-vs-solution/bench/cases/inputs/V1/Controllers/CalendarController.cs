using BerthBook.Contracts;
using BerthBook.Data;
using BerthBook.Models;
using BerthBook.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BerthBook.Controllers;

/// <summary>Публичные методы для сайта марины.</summary>
[ApiController]
[Route("api/berths")]
[AllowAnonymous]
public class CalendarController : ControllerBase
{
    private const int MaxCalendarDays = 92;

    private readonly MarinaDbContext _db;
    private readonly TariffCalculator _tariff;

    public CalendarController(MarinaDbContext db, TariffCalculator tariff)
    {
        _db = db;
        _tariff = tariff;
    }

    [HttpGet("{berthId:int}/calendar")]
    public async Task<ActionResult<List<CalendarSlotDto>>> Calendar(
        int berthId,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        if (to <= from || to.DayNumber - from.DayNumber > MaxCalendarDays)
            return BadRequest(new { error = $"Период - от 1 до {MaxCalendarDays} дней" });

        var bookings = await _db.Bookings.AsNoTracking()
            .Include(b => b.Vessel)
            .Where(b => b.BerthId == berthId)
            .Where(BookingQueries.Occupying(DateTime.UtcNow))
            .Where(BookingQueries.Overlaps(from, to))
            .OrderBy(b => b.Arrival)
            .ToListAsync(ct);

        return bookings
            .Select(b => new CalendarSlotDto(
                b.Arrival,
                b.Departure,
                b.Status == BookingStatus.Confirmed,
                VesselDto.From(b.Vessel)))
            .ToList();
    }

    [HttpGet("{berthId:int}/quote")]
    public async Task<ActionResult<QuoteDto>> Quote(
        int berthId,
        [FromQuery] decimal lengthM,
        [FromQuery] DateOnly arrival,
        [FromQuery] DateOnly departure,
        CancellationToken ct)
    {
        if (lengthM <= 0 || departure <= arrival
            || departure.DayNumber - arrival.DayNumber > CreateBookingRequest.MaxNights)
            return BadRequest(new { error = "Некорректные параметры расчёта" });

        var berth = await _db.Berths.AsNoTracking()
            .Include(b => b.SeasonalRates)
            .SingleOrDefaultAsync(b => b.Id == berthId, ct);
        if (berth is null)
            return NotFound();

        var quote = _tariff.Calculate(berth, new Vessel { LengthM = lengthM }, arrival, departure);
        return QuoteDto.From(quote);
    }
}
