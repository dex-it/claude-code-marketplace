using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ConfReg.Data;
using ConfReg.Models;
using ConfReg.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ConfReg.Controllers;

public sealed class GroupOrderRequest
{
    public int TicketTypeId { get; set; }

    [Range(1, 500)]
    public int Quantity { get; set; }
}

public sealed record GroupOrderResponse(int OrderId, int Quantity, long AmountKopecks);

[ApiController]
[Route("api/conferences/{conferenceId:int}/group-orders")]
[Authorize(Roles = Roles.OrgAdmin)]
public class GroupOrdersController : ControllerBase
{
    private static readonly TimeSpan IdempotencyWindow = TimeSpan.FromHours(24);

    private readonly ConfDbContext _db;
    private readonly IMemoryCache _cache;

    public GroupOrdersController(ConfDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    [HttpPost]
    public async Task<ActionResult<GroupOrderResponse>> Create(
        int conferenceId,
        GroupOrderRequest req,
        [FromHeader(Name = "Idempotency-Key")] string idempotencyKey,
        CancellationToken ct)
    {
        var orgId = User.FindFirstValue("org_id")!;
        var cacheKey = $"group-order:{orgId}:{idempotencyKey}";
        if (_cache.TryGetValue(cacheKey, out GroupOrderResponse? cached))
            return cached!;

        var ticket = await _db.TicketTypes
            .SingleOrDefaultAsync(t => t.Id == req.TicketTypeId && t.ConferenceId == conferenceId, ct);
        if (ticket is null)
            return NotFound();

        var unitPrice = PricingService.BasePrice(ticket, DateOnly.FromDateTime(DateTime.UtcNow));

        var order = new GroupOrder
        {
            ConferenceId = conferenceId,
            OrganizationId = orgId,
            TicketTypeId = ticket.Id,
            Quantity = req.Quantity,
            AmountKopecks = unitPrice * req.Quantity,
            CreatedBy = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            CreatedAt = DateTime.UtcNow,
        };
        _db.GroupOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        var response = new GroupOrderResponse(order.Id, order.Quantity, order.AmountKopecks);
        _cache.Set(cacheKey, response, IdempotencyWindow);
        return response;
    }
}
