using System.ComponentModel.DataAnnotations;
using GrantDesk.Data;
using GrantDesk.Models;
using GrantDesk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Controllers;

public sealed class AssignRequest
{
    [Required]
    public string ExpertId { get; set; } = "";

    [Required, MaxLength(200)]
    public string ExpertName { get; set; } = "";

    [Required, MinLength(1)]
    public List<int> ApplicationIds { get; set; } = new();
}

[ApiController]
[Route("api/contests")]
[Authorize(Roles = Roles.Coordinator)]
public class ContestsController : ControllerBase
{
    private readonly GrantsDbContext _db;
    private readonly RankingService _ranking;

    public ContestsController(GrantsDbContext db, RankingService ranking)
    {
        _db = db;
        _ranking = ranking;
    }

    [HttpGet("{id:int}/ranking")]
    public async Task<ActionResult<IReadOnlyList<RankingRow>>> Ranking(int id, CancellationToken ct)
    {
        if (!await _db.Contests.AnyAsync(c => c.Id == id, ct))
            return NotFound();

        return Ok(await _ranking.BuildAsync(id, ct));
    }

    [HttpPost("{id:int}/assignments")]
    public async Task<IActionResult> Assign(int id, AssignRequest req, CancellationToken ct)
    {
        var applications = await _db.Applications
            .Where(a => a.ContestId == id
                        && a.Status == ApplicationStatus.Submitted
                        && req.ApplicationIds.Contains(a.Id))
            .Select(a => new { a.Id, a.ApplicantId })
            .ToListAsync(ct);

        if (applications.Count != req.ApplicationIds.Distinct().Count())
            return UnprocessableEntity(new { error = "Часть заявок не найдена в конкурсе" });
        if (applications.Any(a => a.ApplicantId == req.ExpertId))
            return UnprocessableEntity(new { error = "Эксперт не может оценивать собственную заявку" });

        var alreadyAssigned = await _db.Reviews
            .Where(r => r.ExpertId == req.ExpertId && req.ApplicationIds.Contains(r.ApplicationId))
            .Select(r => r.ApplicationId)
            .ToListAsync(ct);

        foreach (var app in applications.Where(a => !alreadyAssigned.Contains(a.Id)))
        {
            _db.Reviews.Add(new Review
            {
                ApplicationId = app.Id,
                ExpertId = req.ExpertId,
                ExpertName = req.ExpertName,
                Status = ReviewStatus.Assigned,
            });
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:int}/close-review")]
    public async Task<IActionResult> CloseReview(int id, CancellationToken ct)
    {
        var contest = await _db.Contests.SingleOrDefaultAsync(c => c.Id == id, ct);
        if (contest is null)
            return NotFound();
        if (contest.ReviewClosed)
            return Conflict(new { error = "Экспертиза уже закрыта" });

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var expired = await _db.Reviews
            .Where(r => r.Application.ContestId == id && r.Status != ReviewStatus.Submitted)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, ReviewStatus.Expired), ct);

        contest.ReviewClosed = true;
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return Ok(new { expired });
    }
}
