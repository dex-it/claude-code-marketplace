using System.Security.Claims;
using ConfReg.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConfReg.Controllers;

public static class Roles
{
    public const string OrgAdmin = "OrgAdmin";
    public const string Organizer = "Organizer";
}

[ApiController]
[Authorize]
public class RegistrationsController : ControllerBase
{
    private readonly RegistrationService _service;
    private readonly PricingService _pricing;

    public RegistrationsController(RegistrationService service, PricingService pricing)
    {
        _service = service;
        _pricing = pricing;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpPost("api/conferences/{conferenceId:int}/registrations")]
    public async Task<IActionResult> Register(int conferenceId, RegisterRequest req, CancellationToken ct)
    {
        var result = await _service.RegisterAsync(conferenceId, CurrentUserId, User.FindFirstValue("org_id"), req, ct);
        return result.Error switch
        {
            RegisterError.TicketNotFound => NotFound(),
            RegisterError.AlreadyRegistered => Conflict(new { error = "Вы уже зарегистрированы на эту конференцию" }),
            _ => Ok(new { result.Registration!.Id, result.Registration.PriceKopecks }),
        };
    }

    [HttpGet("api/promo-codes/check")]
    public async Task<IActionResult> CheckPromo([FromQuery] int conferenceId, [FromQuery] string code, CancellationToken ct)
    {
        var promo = await _pricing.FindPromoAsync(conferenceId, code, ct);
        if (promo is null || !PricingService.IsUsable(promo, DateOnly.FromDateTime(DateTime.UtcNow)))
            return NotFound();

        return Ok(new { promo.Kind, promo.Value });
    }

    [HttpPost("api/registrations/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var result = await _service.CancelAsync(id, CurrentUserId, User.IsInRole(Roles.OrgAdmin), ct);
        return result.Status switch
        {
            CancelStatus.NotFound => NotFound(),
            CancelStatus.Forbidden => Forbid(),
            CancelStatus.AlreadyCancelled => Conflict(new { error = "Регистрация уже отменена" }),
            _ => Ok(new { refundKopecks = result.RefundKopecks }),
        };
    }
}
