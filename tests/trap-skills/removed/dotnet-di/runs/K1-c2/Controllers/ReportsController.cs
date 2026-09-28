using Microsoft.AspNetCore.Mvc;
using Notify.Api.Services;

namespace Notify.Api.Controllers;

[ApiController]
[Route("reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly INotificationSender _emailSender;

    public ReportsController([FromKeyedServices(NotificationChannels.Email)] INotificationSender emailSender)
        => _emailSender = emailSender;

    [HttpPost("{id:guid}/send")]
    public async Task<IActionResult> Send(Guid id, [FromQuery] string email, CancellationToken ct)
    {
        await _emailSender.SendAsync(email, $"Отчёт {id} готов", ct);
        return NoContent();
    }
}
