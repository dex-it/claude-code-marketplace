using System.Security.Claims;
using HoneyCoop.Contracts;
using HoneyCoop.Data;
using HoneyCoop.Models;
using HoneyCoop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Controllers;

[ApiController]
[Route("api/payouts")]
[Authorize(Roles = "Accountant")]
public class PayoutsController : ControllerBase
{
    private readonly CoopDbContext _db;
    private readonly PayoutService _payouts;
    private readonly BankRegistryService _registry;

    public PayoutsController(CoopDbContext db, PayoutService payouts, BankRegistryService registry)
    {
        _db = db;
        _payouts = payouts;
        _registry = registry;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PayoutDto>> Get(int id, CancellationToken ct)
    {
        var payout = await _db.Payouts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);
        return payout is null ? NotFound() : ToDto(payout);
    }

    [HttpPost]
    public async Task<IActionResult> Calculate(CalculatePayoutRequest req, CancellationToken ct)
    {
        var result = await _payouts.CalculateAsync(req.MemberId, req.Year, req.Month, CurrentUserId, ct);
        return result.Error switch
        {
            PayoutError.None => CreatedAtAction(nameof(Get), new { id = result.Payout!.Id }, ToDto(result.Payout)),
            _ => ErrorResponse(result.Error),
        };
    }

    [HttpPut("{id:int}/adjustment")]
    public async Task<IActionResult> Adjust(int id, AdjustPayoutRequest req, CancellationToken ct)
    {
        var result = await _payouts.AdjustAsync(id, req, ct);
        return result.Error == PayoutError.None ? Ok(ToDto(result.Payout!)) : ErrorResponse(result.Error);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await _payouts.DeleteDraftAsync(id, ct);
        return result.Error == PayoutError.None ? NoContent() : ErrorResponse(result.Error);
    }

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, CancellationToken ct)
    {
        var result = await _payouts.ApproveAsync(id, CurrentUserId, ct);
        return result.Error == PayoutError.None ? NoContent() : ErrorResponse(result.Error);
    }

    [HttpPost("registry")]
    public async Task<IActionResult> ExportRegistry(CancellationToken ct)
    {
        var registry = await _registry.ExportAsync(ct);
        return registry is null ? NoContent() : Ok(registry);
    }

    private IActionResult ErrorResponse(PayoutError error) => error switch
    {
        PayoutError.NotFound => NotFound(),
        PayoutError.AlreadyExists => Conflict(new { error = "Выплата за этот месяц уже рассчитана" }),
        PayoutError.NoBatches => UnprocessableEntity(new { error = "За месяц нет принятых партий" }),
        PayoutError.MissingPrice => UnprocessableEntity(new { error = "Нет цены в прейскуранте на дату приёмки" }),
        PayoutError.NotDraft => Conflict(new { error = "Выплата уже утверждена" }),
        PayoutError.NegativeAmount => UnprocessableEntity(new { error = "Сумма к выплате получается отрицательной" }),
        PayoutError.SameAccountant => Conflict(new { error = "Утверждает другой бухгалтер, не тот, кто считал выплату" }),
        _ => StatusCode(StatusCodes.Status500InternalServerError),
    };

    private static PayoutDto ToDto(Payout p) => new(
        p.Id, p.MemberId, p.Year, p.Month, p.GrossAmount, p.Fee, p.AdvanceWithheld,
        p.Bonus, p.OtherDeductions, p.NetAmount, p.Status, p.CreatedBy, p.ApprovedBy, p.ExportedAt);
}
