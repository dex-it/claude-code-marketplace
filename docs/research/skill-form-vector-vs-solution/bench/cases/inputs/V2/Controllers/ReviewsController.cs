using System.Security.Claims;
using GrantDesk.Contracts;
using GrantDesk.Data;
using GrantDesk.Models;
using GrantDesk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Controllers;

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
    public async Task<ActionResult<MyReviewsPage>> Mine(CancellationToken ct)
    {
        var userId = CurrentUserId;
        var mine = _db.Reviews.AsNoTracking().Where(r => r.ExpertId == userId);

        var itemsTask = mine
            .OrderBy(r => r.Status).ThenBy(r => r.Id)
            .Select(r => new MyReviewDto(r.Id, r.ApplicationId, r.Application.Title, r.Status, r.Total))
            .ToListAsync(ct);
        var submittedTask = mine.CountAsync(r => r.Status == ReviewStatus.Submitted, ct);

        await Task.WhenAll(itemsTask, submittedTask);

        var items = itemsTask.Result;
        return new MyReviewsPage(items, submittedTask.Result, items.Count);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ReviewDetailsDto>> Get(int id, CancellationToken ct)
    {
        var dto = await _service.GetMineAsync(id, CurrentUserId, ct);
        return dto is null ? NotFound() : dto;
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
            SaveReviewResult.Saved => NoContent(),
            SaveReviewResult.NotFound => NotFound(),
            SaveReviewResult.AlreadySubmitted => Conflict(new { error = "Оценка уже отправлена" }),
            SaveReviewResult.ReviewClosed => Conflict(new { error = "Приём оценок по конкурсу закрыт" }),
            _ => UnprocessableEntity(new
            {
                error = submit
                    ? "Нужны оценки по всем критериям конкурса, каждая не выше максимума критерия"
                    : "Оценки должны относиться к критериям конкурса и не превышать их максимум",
            }),
        };
    }
}
