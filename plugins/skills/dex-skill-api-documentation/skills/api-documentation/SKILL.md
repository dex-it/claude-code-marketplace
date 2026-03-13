---
name: api-documentation
description: OpenAPI/Swagger документация — частые ошибки. Активируется при swagger, openapi, api documentation, swashbuckle, nswag
allowed-tools: Read, Grep, Glob
---

# API Documentation

> Swagger/OpenAPI анти-паттерны включены в **dex-skill-api-development** (секция "Swagger — частые ошибки").
> Этот skill — краткая выжимка ключевых ловушек.

## Ловушки

```csharp
// Плохо — нет ProducesResponseType → Swagger показывает только 200
[HttpGet("{id}")]
public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct)
{
    var product = await _service.GetAsync(id, ct);
    if (product is null) return NotFound(); // клиент не знает что бывает 404
    return Ok(product);
}

// Хорошо — все возможные ответы документированы
[HttpGet("{id}")]
[ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct) { }

// Плохо — IActionResult → Swagger не знает тип ответа → генерация клиентов невозможна
public async Task<IActionResult> GetById(int id, CancellationToken ct) { }

// Хорошо — ActionResult<T>
public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct) { }

// Плохо — забыли GenerateDocumentationFile в .csproj
// Все <summary> и <example> молча игнорируются Swagger'ом

// Плохо — internal endpoints видны в публичном Swagger
// Хорошо — [ApiExplorerSettings(IgnoreApi = true)]
```

## Чек-лист

- [ ] `[ProducesResponseType]` на каждом endpoint
- [ ] ActionResult\<T\>, не IActionResult
- [ ] XML comments с `<example>` на request/response models
- [ ] `GenerateDocumentationFile` включен в .csproj
- [ ] Internal endpoints скрыты (`[ApiExplorerSettings(IgnoreApi = true)]`)
- [ ] NSwag/Kiota генерация клиентов в CI
