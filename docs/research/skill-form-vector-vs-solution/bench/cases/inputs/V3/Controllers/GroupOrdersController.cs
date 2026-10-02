using System.Security.Claims;
using ConfReg.Contracts;
using ConfReg.Data;
using ConfReg.Models;
using ConfReg.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Controllers;

[ApiController]
[Route("api/conferences/{conferenceId:int}/group-orders")]
[Authorize(Roles = Roles.OrgAdmin)]
public class GroupOrdersController : ControllerBase
{
    private readonly ConfDbContext _db;
    private readonly GroupOrderService _service;

    public GroupOrdersController(ConfDbContext db, GroupOrderService service)
    {
        _db = db;
        _service = service;
    }

    private string OrgId => User.FindFirstValue("org_id")!;

    [HttpGet]
    public async Task<ActionResult<List<GroupOrderDto>>> List(int conferenceId, CancellationToken ct)
    {
        var orgId = OrgId;
        return await _db.GroupOrders.AsNoTracking()
            .Where(o => o.ConferenceId == conferenceId && o.OrganizationId == orgId)
            .OrderBy(o => o.Id)
            .Select(o => new GroupOrderDto(
                o.Id,
                o.TicketTypeId,
                o.Quantity,
                o.AmountKopecks,
                o.InvoiceNumber,
                o.Participants.Count(p => p.Status != RegistrationStatus.Cancelled)))
            .ToListAsync(ct);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        int conferenceId,
        GroupOrderRequest req,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 64)
            return BadRequest(new { error = "Нужен заголовок Idempotency-Key (до 64 символов)" });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var result = await _service.CreateAsync(conferenceId, OrgId, userId, idempotencyKey, req, ct);

        return result.Error switch
        {
            GroupOrderError.NotFound => NotFound(),
            GroupOrderError.SoldOut => Conflict(new { error = "Столько свободных мест на конференции нет" }),
            _ => StatusCode(result.Replayed ? StatusCodes.Status200OK : StatusCodes.Status201Created, ToDto(result.Order!)),
        };
    }

    [HttpPost("{orderId:int}/participants")]
    public async Task<IActionResult> AddParticipant(int conferenceId, int orderId, AddParticipantRequest req, CancellationToken ct)
    {
        var result = await _service.AddParticipantAsync(conferenceId, orderId, OrgId, req, ct);
        return result.Error switch
        {
            GroupOrderError.NotFound => NotFound(),
            GroupOrderError.NoSeatsLeft => Conflict(new { error = "Все места заказа уже заняты" }),
            _ => Ok(new { registrationId = result.Registration!.Id }),
        };
    }

    private static GroupOrderDto ToDto(GroupOrder o) =>
        new(o.Id, o.TicketTypeId, o.Quantity, o.AmountKopecks, o.InvoiceNumber, 0);
}
