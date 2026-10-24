using Microsoft.AspNetCore.Mvc;
using Pricing.Api.Caching;
using Pricing.Api.Contracts;
using Pricing.Application.Products;
using Pricing.Domain;

namespace Pricing.Api.Controllers;

public sealed record ChangePriceRequest(decimal Price);

[ApiController]
[Route("api")]
public sealed class CatalogController(CatalogCache cache, ProductService products) : ControllerBase
{
    [HttpGet("catalog/products/{id:guid}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> Card(Guid id, CancellationToken ct) =>
        await cache.GetCardAsync(id, ct);

    [HttpGet("catalog/categories/{category}/products")]
    public async Task<ActionResult<List<ProductDto>>> Category(Category category, CancellationToken ct) =>
        await cache.GetCategoryAsync(category, ct);

    [HttpPut("products/{id:guid}/price")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangePrice(Guid id, ChangePriceRequest request, CancellationToken ct)
    {
        var product = await products.ChangePriceAsync(id, request.Price, ct);
        await cache.InvalidateProductAsync(product.Category, ct);
        return NoContent();
    }

    [HttpPost("support/cache/flush")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Flush(CancellationToken ct)
    {
        await cache.FlushAsync(ct);
        return NoContent();
    }
}
