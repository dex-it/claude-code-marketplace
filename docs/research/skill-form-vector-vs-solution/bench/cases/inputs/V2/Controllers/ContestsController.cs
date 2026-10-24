using GrantDesk.Contracts;
using GrantDesk.Data;
using GrantDesk.Models;
using GrantDesk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Controllers;

[ApiController]
[Route("api/contests")]
[Authorize(Roles = Roles.Coordinator + "," + Roles.Expert)]
public class ContestsController : ControllerBase
{
    private readonly GrantsDbContext _db;
    private readonly RankingService _ranking;

    public ContestsController(GrantsDbContext db, RankingService ranking)
    {
        _db = db;
        _ranking = ranking;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ContestDto>> Get(int id, CancellationToken ct)
    {
        var dto = await _db.Contests.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new ContestDto(
                c.Id,
                c.Title,
                c.ReviewDeadline,
                c.ReviewClosed,
                c.Criteria.OrderBy(x => x.Id).Select(x => new CriterionDto(x.Id, x.Name, x.MaxScore, x.Weight)).ToList()))
            .SingleOrDefaultAsync(ct);

        return dto is null ? NotFound() : dto;
    }

    [HttpGet("{id:int}/ranking")]
    public async Task<ActionResult<IReadOnlyList<RankingRow>>> Ranking(int id, CancellationToken ct)
    {
        var rows = await _ranking.BuildAsync(id, ct);
        return rows is null ? NotFound() : Ok(rows);
    }

    [HttpGet("{id:int}/ranking.csv")]
    public async Task<IActionResult> RankingCsv(int id, CancellationToken ct)
    {
        var rows = await _ranking.BuildAsync(id, ct);
        if (rows is null)
            return NotFound();

        return File(RankingCsvWriter.Write(rows), "text/csv; charset=utf-8", $"ranking-{id}.csv");
    }

    [HttpPost("{id:int}/close-review")]
    [Authorize(Roles = Roles.Coordinator)]
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
