using System.Security.Claims;
using GrantDesk.Data;
using GrantDesk.Models;
using GrantDesk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Controllers;

public sealed record MyReviewDto(int ReviewId, int ApplicationId, string ApplicationTitle, ReviewStatus Status, decimal Total);

[ApiController]
[Route("api/reviews")]
[Authorize(Roles = Roles.Expert)]
public class ReviewsController : ControllerBase
{
    private readonly GrantsDbContext _db;
    private readonly ReviewService _service;

    public ReviewsController(GrantsDbContext db, ReviewService service)
    {
        _db = db;
        _service = service;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("mine")]
    public async Task<ActionResult<List<MyReviewDto>>> Mine(CancellationToken ct)
    {
        var userId = CurrentUserId;
        return await _db.Reviews.AsNoTracking()
            .Where(r => r.ExpertId == userId)
            .OrderBy(r => r.Status).ThenBy(r => r.Id)
            .Select(r => new MyReviewDto(r.Id, r.ApplicationId, r.Application.Title, r.Status, r.Total))
            .ToListAsync(ct);
    }

    [HttpPut("{id:int}")]
    public Task<IActionResult> SaveDraft(int id, SaveReviewRequest req, CancellationToken ct)
        => Save(id, req, submit: false, ct);

    [HttpPost("{id:int}/submit")]
    public Task<IActionResult> Submit(int id, SaveReviewRequest req, CancellationToken ct)
        => Save(id, req, submit: true, ct);

    private async Task<IActionResult> Save(int id, SaveReviewRequest req, bool submit, CancellationToken ct)
    {
        var result = await _service.SaveAsync(id, CurrentUserId, req, submit, ct);
        return result switch
        {
            SaveReviewResult.NotFound => NotFound(),
            SaveReviewResult.AlreadySubmitted => Conflict(new { error = "Оценка уже отправлена" }),
            SaveReviewResult.ReviewClosed => Conflict(new { error = "Экспертиза по конкурсу закрыта" }),
            _ => NoContent(),
        };
    }
}
