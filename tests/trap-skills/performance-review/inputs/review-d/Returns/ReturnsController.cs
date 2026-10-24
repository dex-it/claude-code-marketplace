using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Data;
using Shop.Api.Infrastructure;

namespace Shop.Api.Returns;

[ApiController]
[Route("api/returns")]
public sealed class ReturnsController(
    ShopDbContext db,
    ReturnService service,
    ReturnMapper mapper,
    ITenantService tenants) : ControllerBase
{
    [HttpGet]
    public async Task<ReturnPage> List(
        [FromQuery] ReturnStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(page, 1);

        var query = db.ReturnRequests.Where(r => r.TenantId == tenants.CurrentTenantId);
        if (status is not null)
            query = query.Where(r => r.Status == status);

        var requests = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new ReturnPage(requests.Select(mapper.ToListItem).ToList(), page, pageSize);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateReturnCommand cmd, CancellationToken ct)
    {
        var (created, errors) = await service.CreateAsync(tenants.CurrentTenantId, cmd, ct);
        if (created is null)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]> { ["return"] = errors.ToArray() }));
        return CreatedAtAction(nameof(List), new { id = created.Id }, new { created.Id });
    }

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, CancellationToken ct) =>
        await service.ApproveAsync(tenants.CurrentTenantId, id, ct) ? NoContent() : NotFound();

    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, CancellationToken ct) =>
        await service.RejectAsync(tenants.CurrentTenantId, id, ct) ? NoContent() : NotFound();
}
