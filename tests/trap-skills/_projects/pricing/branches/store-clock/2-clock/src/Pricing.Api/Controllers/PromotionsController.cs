using Microsoft.AspNetCore.Mvc;
using Pricing.Api.Contracts;
using Pricing.Application.Promotions;
using Pricing.Domain;

namespace Pricing.Api.Controllers;

[ApiController]
[Route("api/promotions")]
public sealed class PromotionsController(PromotionService promotions) : ControllerBase
{
    /// <summary>Скидка категории, действующая сейчас по времени магазина; 0 - акции нет.</summary>
    [HttpGet("active")]
    [ProducesResponseType<ActiveDiscountDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ActiveDiscountDto>> Active([FromQuery] Category category, CancellationToken ct) =>
        new ActiveDiscountDto(category, await promotions.CurrentDiscountAsync(category, ct));
}
