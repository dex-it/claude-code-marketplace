using GrantDesk.Contracts;
using GrantDesk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GrantDesk.Controllers;

[ApiController]
[Route("api/contests/{contestId:int}/assignments")]
[Authorize(Roles = Roles.Coordinator)]
public class AssignmentsController : ControllerBase
{
    private readonly AssignmentService _service;

    public AssignmentsController(AssignmentService service)
    {
        _service = service;
    }

    [HttpPost]
    public async Task<IActionResult> Assign(int contestId, AssignRequest req, CancellationToken ct)
        => ToResponse(await _service.AssignAsync(contestId, req, ct));

    [HttpPost("reassign")]
    public async Task<IActionResult> Reassign(int contestId, ReassignRequest req, CancellationToken ct)
        => ToResponse(await _service.ReassignAsync(contestId, req, ct));

    private IActionResult ToResponse(AssignResult result) => result.Status switch
    {
        AssignStatus.Done => Ok(new { assigned = result.Count }),
        AssignStatus.ExpertNotFound => UnprocessableEntity(new { error = "Эксперт не найден или неактивен" }),
        AssignStatus.ApplicationsNotFound => UnprocessableEntity(new { error = "Часть заявок не найдена среди поданных на конкурс" }),
        AssignStatus.ConflictOfInterest => UnprocessableEntity(new
        {
            error = "Конфликт интересов: эксперт не может оценивать эти заявки",
            applicationIds = result.ApplicationIds,
        }),
        _ => Conflict(new { error = "Эксперту уже назначены эти заявки", applicationIds = result.ApplicationIds }),
    };
}
