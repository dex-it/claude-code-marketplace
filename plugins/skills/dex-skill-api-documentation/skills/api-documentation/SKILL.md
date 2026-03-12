---
name: api-documentation
description: OpenAPI/Swagger документация — частые ошибки, versioning. Активируется при swagger, openapi, api documentation, swashbuckle, nswag
allowed-tools: Read, Grep, Glob
---

# API Documentation

## Правила

- `[ProducesResponseType]` для всех возможных HTTP status codes
- XML comments + `<example>` для Swagger UI
- Группируй endpoints по тегам
- Версионируй API — Swagger doc для каждой версии
- Не документируй internal endpoints в публичном Swagger
- Генерируй клиенты из OpenAPI spec (NSwag), не пиши вручную

## Частые ошибки

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
/// <summary>Получить продукт по ID</summary>
/// <response code="200">Продукт найден</response>
/// <response code="404">Продукт не найден</response>
[HttpGet("{id}")]
[ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct)
{ }

// Плохо — Swagger без примеров, клиент гадает что передавать
public record CreateProductRequest(string Name, decimal Price);

// Хорошо — XML examples → Swagger показывает пример payload
/// <summary>Запрос на создание продукта</summary>
public record CreateProductRequest(
    /// <summary>Название</summary>
    /// <example>Ноутбук</example>
    string Name,
    /// <summary>Цена в рублях</summary>
    /// <example>99999.99</example>
    decimal Price);
```

## JWT в Swagger — минимальный setup

```csharp
// AddSwaggerGen — чтобы можно было тестировать защищённые endpoints
options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
{
    Type = SecuritySchemeType.Http,
    Scheme = "bearer",
    BearerFormat = "JWT",
    Description = "Введите JWT токен"
});
options.AddSecurityRequirement(new OpenApiSecurityRequirement
{
    {
        new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        },
        Array.Empty<string>()
    }
});
```

## Чек-лист

- [ ] `[ProducesResponseType]` на каждом endpoint
- [ ] XML comments с `<example>` на request/response models
- [ ] JWT SecurityDefinition если есть авторизация
- [ ] Swagger doc per API version
- [ ] `GenerateDocumentationFile` включен в .csproj
- [ ] NSwag/Kiota генерация клиентов в CI
