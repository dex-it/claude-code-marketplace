using Microsoft.AspNetCore.Mvc;
using Pricing.Api.Contracts;
using Pricing.Application.Products;

namespace Pricing.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(ProductService products) : ControllerBase
{
    public const int MaxPageSize = 100;

    [HttpGet("{id:guid}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> Get(Guid id, CancellationToken ct) =>
        (await products.GetAsync(id, ct)).ToDto();

    [HttpGet]
    public async Task<ActionResult<PageDto<ProductDto>>> List(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var result = await products.ListAsync(page, pageSize, ct);
        return new PageDto<ProductDto>(result.Items.Select(p => p.ToDto()).ToList(), result.Page, result.PageSize, result.Total);
    }

    [HttpPost]
    [ProducesResponseType<ProductDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken ct)
    {
        var product = await products.CreateAsync(
            new CreateProduct(request.Sku, request.Name, request.Category, request.BasePrice, request.SupplierId), ct);
        return CreatedAtAction(nameof(Get), new { id = product.Id }, product.ToDto());
    }
}
