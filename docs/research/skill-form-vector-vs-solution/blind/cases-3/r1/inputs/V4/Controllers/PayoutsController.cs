using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using HoneyCoop.Data;
using HoneyCoop.Models;
using HoneyCoop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Controllers;

public sealed class CalculatePayoutRequest
{
    public int MemberId { get; set; }

    [Range(2020, 2100)]
    public int Year { get; set; }

    [Range(1, 12)]
    public int Month { get; set; }
}

public sealed record PayoutDto(
    int Id,
    int MemberId,
    int Year,
    int Month,
    decimal GrossAmount,
    decimal Fee,
    decimal AdvanceWithheld,
    decimal NetAmount,
    PayoutStatus Status,
    string CreatedBy,
    string? ApprovedBy);

[ApiController]
[Route("api/payouts")]
[Authorize(Roles = "Accountant")]
public class PayoutsController : ControllerBase
{
    private readonly CoopDbContext _db;
    private readonly PayoutService _payouts;

    public PayoutsController(CoopDbContext db, PayoutService payouts)
    {
        _db = db;
        _payouts = payouts;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PayoutDto>> Get(int id, CancellationToken ct)
    {
        var dto = await _db.Payouts.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new PayoutDto(p.Id, p.MemberId, p.Year, p.Month, p.GrossAmount, p.Fee,
                p.AdvanceWithheld, p.NetAmount, p.Status, p.CreatedBy, p.ApprovedBy))
            .SingleOrDefaultAsync(ct);

        return dto is null ? NotFound() : dto;
    }

    [HttpPost]
    public async Task<IActionResult> Calculate(CalculatePayoutRequest req, CancellationToken ct)
    {
        if (!await _db.Members.AnyAsync(m => m.Id == req.MemberId, ct))
            return NotFound();

        var payout = await _payouts.CalculateAsync(req.MemberId, req.Year, req.Month, CurrentUserId, ct);
        if (payout is null)
            return Conflict(new { error = "Выплата за этот месяц уже рассчитана" });

        return CreatedAtAction(nameof(Get), new { id = payout.Id }, new { payout.Id, payout.NetAmount });
    }

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, CancellationToken ct)
    {
        var result = await _payouts.ApproveAsync(id, CurrentUserId, ct);
        return result switch
        {
            ApproveResult.NotFound => NotFound(),
            ApproveResult.AlreadyApproved => Conflict(new { error = "Выплата уже утверждена" }),
            _ => NoContent(),
        };
    }
}
