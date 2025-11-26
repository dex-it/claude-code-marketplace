---
name: api-development
description: Best practices для ASP.NET Core Web API - controllers, endpoints, REST. Активируется при web api, controller, endpoint, REST API
allowed-tools: Read, Grep, Glob
---

# API Development Best Practices

## Структура Controller

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProductsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<List<ProductDto>>> GetAll(CancellationToken ct)
    {
        var products = await _mediator.Send(new GetProductsQuery(), ct);
        return Ok(products);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct)
    {
        var product = await _mediator.Send(new GetProductQuery(id), ct);
        if (product == null)
            return NotFound();
        return Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create(
        CreateProductRequest request,
        CancellationToken ct)
    {
        var product = await _mediator.Send(new CreateProductCommand(request), ct);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, UpdateProductRequest request, CancellationToken ct)
    {
        await _mediator.Send(new UpdateProductCommand(id, request), ct);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteProductCommand(id), ct);
        return NoContent();
    }
}
```

## DTO с record

```csharp
public record CreateProductRequest(string Name, decimal Price);
public record UpdateProductRequest(string Name, decimal Price);
public record ProductDto(int Id, string Name, decimal Price, DateTime CreatedAt);
```

## Валидация с FluentValidation

```csharp
public class CreateProductValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name must not exceed 200 characters");

        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price must be greater than 0");
    }
}

// Регистрация в Program.cs
services.AddValidatorsFromAssemblyContaining<CreateProductValidator>();
services.AddFluentValidationAutoValidation();
```

## Обработка ошибок

```csharp
// Exception Middleware
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { errors = ex.Errors });
        }
        catch (NotFoundException ex)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { error = "Internal server error" });
        }
    }
}
```

## API Versioning

```csharp
// Program.cs
services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
});

// Controller
[ApiVersion("1.0")]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    [MapToApiVersion("1.0")]
    public async Task<ActionResult<List<ProductDtoV1>>> GetAllV1() { }

    [HttpGet]
    [MapToApiVersion("2.0")]
    public async Task<ActionResult<List<ProductDtoV2>>> GetAllV2() { }
}
```

## HTTP Status Codes

```csharp
return Ok(data);           // 200
return Created(...);       // 201
return NoContent();        // 204
return BadRequest(error);  // 400
return Unauthorized();     // 401
return Forbid();           // 403
return NotFound();         // 404
return Conflict();         // 409
```
