using System.Security.Claims;
using HoneyCoop.Contracts;
using HoneyCoop.Data;
using HoneyCoop.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Controllers;

[ApiController]
[Route("api/price-list")]
[Authorize(Roles = "Accountant")]
public class PriceListController : ControllerBase
{
    private readonly CoopDbContext _db;

    public PriceListController(CoopDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<PriceListEntry>>> List(CancellationToken ct) =>
        await _db.PriceList.AsNoTracking()
            .OrderBy(p => p.Grade).ThenBy(p => p.ValidFrom)
            .ToListAsync(ct);

    [HttpPost]
    public async Task<IActionResult> Add(AddPriceRequest req, CancellationToken ct)
    {
        if (await _db.PriceList.AnyAsync(p => p.Grade == req.Grade && p.ValidFrom == req.ValidFrom, ct))
            return Conflict(new { error = "Цена для этого сорта с этой даты уже есть" });

        var previous = await _db.PriceList.AsNoTracking()
            .Where(p => p.Grade == req.Grade && p.ValidFrom < req.ValidFrom)
            .OrderByDescending(p => p.ValidFrom)
            .FirstOrDefaultAsync(ct);

        var entry = new PriceListEntry
        {
            Grade = req.Grade,
            PricePerKg = req.PricePerKg,
            ValidFrom = req.ValidFrom,
        };
        _db.PriceList.Add(entry);

        _db.PriceChanges.Add(new PriceChange
        {
            PriceListEntryId = entry.Id,
            OldPricePerKg = previous?.PricePerKg,
            NewPricePerKg = entry.PricePerKg,
            ChangedBy = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            ChangedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(ct);
        return Created($"/api/price-list/{entry.Id}", entry);
    }
}
