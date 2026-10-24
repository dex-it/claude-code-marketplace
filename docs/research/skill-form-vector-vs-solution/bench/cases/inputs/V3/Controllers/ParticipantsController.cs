using System.Security.Claims;
using ConfReg.Contracts;
using ConfReg.Data;
using ConfReg.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Controllers;

[ApiController]
[Route("api/conferences/{conferenceId:int}/participants")]
[Authorize(Roles = Roles.Organizer + "," + Roles.OrgAdmin)]
public class ParticipantsController : ControllerBase
{
    private readonly ConfDbContext _db;

    public ParticipantsController(ConfDbContext db)
    {
        _db = db;
    }

    /// <summary>Оргкомитет видит всех участников, администратор организации - своих сотрудников.</summary>
    [HttpGet]
    public async Task<ActionResult<List<ParticipantDto>>> List(int conferenceId, CancellationToken ct)
    {
        var query = _db.Registrations.AsNoTracking()
            .Where(r => r.ConferenceId == conferenceId && r.Status != RegistrationStatus.Cancelled);

        if (!User.IsInRole(Roles.Organizer))
        {
            var orgId = User.FindFirstValue("org_id");
            if (orgId is null)
                return Forbid();

            query = query.Where(r => r.OrganizationId == orgId);
        }

        return await query
            .OrderBy(r => r.FullName)
            .Select(ParticipantDto.Projection)
            .ToListAsync(ct);
    }
}
