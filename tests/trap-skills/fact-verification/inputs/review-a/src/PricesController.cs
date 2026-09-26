using Microsoft.AspNetCore.Mvc;

namespace Pricing.Api;

[ApiController]
[Route("prices")]
public sealed class PricesController(PriceService prices, IHttpClientFactory httpFactory) : ControllerBase
{
    // ConfigureAwait(false) здесь не ставим: в ASP.NET Core нет SynchronizationContext,
    // захватывать нечего.
    [HttpGet("{sku}")]
    public async Task<ActionResult<decimal>> Get(string sku, [FromQuery] int discount, CancellationToken ct)
    {
        if (discount is < 0 or > 100) return BadRequest();
        return await prices.GetFinalPriceAsync(sku, discount, ct);
    }

    // Клиент через IHttpClientFactory: пул обработчиков переиспользуется, сокеты не копятся.
    [HttpPost("{sku}/notify")]
    public async Task<IActionResult> Notify(string sku, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("notifications");
        await client.PostAsync($"/price-changed/{sku}", null, ct);
        return Accepted();
    }
}
