using Microsoft.AspNetCore.Mvc;
using Notify.Api.Services;

namespace Notify.Api.Controllers;

[ApiController]
[Route("orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly OrderService _orders;
    public OrdersController(OrderService orders) => _orders = orders;

    [HttpPost("{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id, [FromQuery] string phone, CancellationToken ct)
    {
        await _orders.ConfirmAsync(id, phone, ct);
        return NoContent();
    }
}
