using Microsoft.AspNetCore.Mvc;
using Notify.Api.Services;

namespace Notify.Api.Controllers;

[ApiController]
[Route("reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly ReportService _reports;
    public ReportsController(ReportService reports) => _reports = reports;

    [HttpPost("{id:guid}/send")]
    public async Task<IActionResult> Send(Guid id, [FromQuery] string email, CancellationToken ct)
    {
        await _reports.SendAsync(id, email, ct);
        return NoContent();
    }
}
