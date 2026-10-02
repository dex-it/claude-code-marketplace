using System.Security.Claims;
using ConfReg.Contracts;
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
    private string? CurrentOrgId => User.FindFirstValue("org_id");

    [HttpPost("api/conferences/{conferenceId:int}/registrations")]
    public async Task<IActionResult> Register(int conferenceId, RegisterRequest req, CancellationToken ct)
    {
        var result = await _service.RegisterAsync(conferenceId, CurrentUserId, CurrentOrgId, req, ct);
        return result.Error switch
        {
            RegisterError.None => Ok(new RegisteredDto(result.Registration!.Id, result.Registration.PriceKopecks)),
            RegisterError.TicketNotFound => NotFound(),
            RegisterError.InvalidPromo => UnprocessableEntity(new { error = result.Reason }),
            RegisterError.SoldOut => Conflict(new { error = result.Reason }),
            _ => Conflict(new { error = "Вы уже зарегистрированы на эту конференцию" }),
        };
    }

    [HttpGet("api/promo-codes/check")]
    public async Task<IActionResult> CheckPromo([FromQuery] int conferenceId, [FromQuery] string code, CancellationToken ct)
    {
        var promo = await _pricing.FindPromoAsync(conferenceId, code, ct);
        if (promo is null)
            return NotFound(new { error = "Промокод не найден" });

        var why = PricingService.WhyUnusable(promo, PricingService.Today());
        if (why is not null)
            return UnprocessableEntity(new { error = why });

        return Ok(new { promo.Kind, promo.Value });
    }

    [HttpPost("api/registrations/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var result = await _service.CancelAsync(id, CurrentUserId, User.IsInRole(Roles.OrgAdmin), CurrentOrgId, ct);
        return result.Status switch
        {
            CancelStatus.Cancelled => Ok(new { refundKopecks = result.RefundKopecks }),
            CancelStatus.NotFound => NotFound(),
            CancelStatus.Forbidden => Forbid(),
            _ => Conflict(new { error = "Регистрация уже отменена" }),
        };
    }
}
