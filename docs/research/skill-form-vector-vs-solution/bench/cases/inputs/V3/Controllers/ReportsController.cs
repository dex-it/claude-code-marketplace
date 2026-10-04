using ConfReg.Data;
using ConfReg.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Controllers;

public sealed record TicketTypeReportRow(string TicketType, int Registrations, int Paid, long PaidKopecks);

[ApiController]
[Route("api/reports")]
[Authorize(Roles = Roles.Organizer)]
public class ReportsController : ControllerBase
{
    private const int MaxPeriodDays = 366;

    private readonly ConfDbContext _db;

    public ReportsController(ConfDbContext db)
    {
        _db = db;
    }

    [HttpGet("registrations")]
    public async Task<ActionResult<List<TicketTypeReportRow>>> Registrations(
        [FromQuery] int conferenceId,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > MaxPeriodDays)
            return BadRequest(new { error = "Некорректный период отчёта" });

        var fromTs = from.ToDateTime(TimeOnly.MinValue);
        var toTs = to.AddDays(1).ToDateTime(TimeOnly.MinValue);

        return await _db.Registrations.AsNoTracking()
            .Where(r => r.ConferenceId == conferenceId && r.CreatedAt >= fromTs && r.CreatedAt < toTs)
            .GroupBy(r => r.TicketType.Name)
            .Select(g => new TicketTypeReportRow(
                g.Key,
                g.Count(),
                g.Count(r => r.Status == RegistrationStatus.Paid),
                g.Sum(r => r.Status == RegistrationStatus.Paid ? r.PriceKopecks : 0L)))
            .OrderBy(x => x.TicketType)
            .ToListAsync(ct);
    }
}
