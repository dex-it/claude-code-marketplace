using Bookings.Api.Auth;
using Bookings.Api.Contracts;
using Bookings.Api.Data;
using Bookings.Api.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bookings.Api.Controllers;

[ApiController]
[Route("api/v1/rooms")]
public class RoomsController(BookingsDbContext db, ILogger<RoomsController> logger) : ControllerBase
{
    private const int DefaultLimit = 20;
    private const int MaxLimit = 100;

    [HttpGet]
    public async Task<ActionResult<PageDto<RoomDto>>> List(
        int limit = DefaultLimit, int offset = 0, int? minCapacity = null, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string[]>();
        if (limit is < 1 or > MaxLimit)
            errors["limit"] = [$"limit - от 1 до {MaxLimit}."];
        if (offset < 0)
            errors["offset"] = ["offset не может быть отрицательным."];
        if (minCapacity is < Room.MinCapacity or > Room.MaxCapacity)
            errors["minCapacity"] = [$"minCapacity - от {Room.MinCapacity} до {Room.MaxCapacity}."];
        if (errors.Count > 0)
            return this.ValidationErrors(errors);

        var query = db.Rooms.AsNoTracking();
        if (minCapacity is not null)
            query = query.Where(r => r.Capacity >= minCapacity.Value);

        var total = await query.CountAsync(cancellationToken);
        var rooms = await query
            .OrderBy(r => r.Id)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return new PageDto<RoomDto>(rooms.Select(RoomDto.From).ToList(), total);
    }

    [HttpGet("{roomId}")]
    public async Task<ActionResult<RoomDto>> Get(string roomId, CancellationToken cancellationToken)
    {
        var room = await db.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == roomId, cancellationToken);
        if (room is null)
            return this.ProblemWithCode(StatusCodes.Status404NotFound, "room-not-found", "Комната не найдена.");

        return RoomDto.From(room);
    }

    // Устарело с 1.2.0: замена - GET /api/v1/bookings?roomId=, удаление после 2027-03-01
    [HttpGet("{roomId}/bookings")]
    public async Task<ActionResult<IReadOnlyList<BookingDto>>> ListRoomBookings(
        string roomId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken cancellationToken)
    {
        if (!await db.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken))
            return this.ProblemWithCode(StatusCodes.Status404NotFound, "room-not-found", "Комната не найдена.");

        var query = db.Bookings.AsNoTracking().Where(b => b.RoomId == roomId);
        if (from is not null)
            query = query.Where(b => b.EndsAt > from.Value.ToUniversalTime());
        if (to is not null)
            query = query.Where(b => b.StartsAt < to.Value.ToUniversalTime());

        var bookings = await query.OrderBy(b => b.StartsAt).ToListAsync(cancellationToken);
        return bookings.Select(BookingDto.From).ToList();
    }

    [HttpPost("/api/v1/internal/rooms/reindex")]
    [Authorize(Roles = Roles.Admin)]
    public IActionResult Reindex()
    {
        logger.LogInformation("Rooms reindex requested by {UserId}", User.UserId());
        return Accepted();
    }
}
