using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Notify.Api.Services;

namespace Notify.Api.Controllers;

[ApiController]
[Route("reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly INotificationSender _sender;

    public ReportsController([FromKeyedServices("email")] INotificationSender sender) => _sender = sender;

    [HttpPost("{id:guid}/send")]
    public async Task<IActionResult> Send(Guid id, [FromQuery] string email, CancellationToken ct)
    {
        await _sender.SendAsync(email, $"Отчёт {id} готов", ct);
        return NoContent();
    }
}
