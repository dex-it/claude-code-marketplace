using System.Security.Claims;
using GrantDesk.Data;
using GrantDesk.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Controllers;

public static class Roles
{
    public const string Expert = "Expert";
    public const string Coordinator = "Coordinator";
}

public sealed record ReviewSummaryDto(string ExpertName, decimal Total, string? Comment, DateTime? SubmittedAt);

public sealed record ApplicationDetailsDto(
    int Id,
    string Title,
    string ApplicantName,
    string Region,
    decimal RequestedAmount,
    ApplicationStatus Status,
    List<ReviewSummaryDto> Reviews);

public sealed record ApplicationListItemDto(int Id, string Title, string ApplicantName, string Region, decimal RequestedAmount);

[ApiController]
[Route("api/applications")]
[Authorize(Roles = Roles.Expert + "," + Roles.Coordinator)]
public class ApplicationsController : ControllerBase
{
    private readonly GrantsDbContext _db;

    public ApplicationsController(GrantsDbContext db)
    {
        _db = db;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApplicationDetailsDto>> Get(int id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var isCoordinator = User.IsInRole(Roles.Coordinator);

        if (!isCoordinator)
        {
            var assigned = await _db.Reviews.AnyAsync(r => r.ApplicationId == id && r.ExpertId == userId, ct);
            if (!assigned)
                return NotFound();
        }

        var app = await _db.Applications.AsNoTracking()
            .Include(a => a.Reviews.Where(r => r.Status == ReviewStatus.Submitted))
            .SingleOrDefaultAsync(a => a.Id == id, ct);
        if (app is null)
            return NotFound();

        // Экспертиза слепая: оценки коллег видит только координатор.
        var reviews = isCoordinator
            ? app.Reviews.Select(r => new ReviewSummaryDto(r.ExpertName, r.Total, r.Comment, r.SubmittedAt)).ToList()
            : new List<ReviewSummaryDto>();

        return new ApplicationDetailsDto(
            app.Id,
            app.Title,
            app.ApplicantName,
            app.Region,
            app.RequestedAmount,
            app.Status,
            reviews);
    }

    [HttpGet]
    [Authorize(Roles = Roles.Coordinator)]
    public async Task<ActionResult<List<ApplicationListItemDto>>> Search(
        [FromQuery] int contestId,
        [FromQuery] string? region,
        CancellationToken ct)
    {
        var query = _db.Applications.AsNoTracking()
            .Where(a => a.ContestId == contestId && a.Status != ApplicationStatus.Draft);

        if (!string.IsNullOrWhiteSpace(region))
        {
            var r = region.Trim();
            query = query.Where(a => a.Region.Equals(r, StringComparison.OrdinalIgnoreCase));
        }

        return await query
            .OrderBy(a => a.Id)
            .Select(a => new ApplicationListItemDto(a.Id, a.Title, a.ApplicantName, a.Region, a.RequestedAmount))
            .ToListAsync(ct);
    }
}
