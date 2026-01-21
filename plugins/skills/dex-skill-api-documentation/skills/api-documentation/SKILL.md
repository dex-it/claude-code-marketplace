---
name: api-documentation
description: OpenAPI/Swagger документация, Swashbuckle, NSwag, API versioning. Активируется при swagger, openapi, api documentation, swashbuckle, nswag, api version
allowed-tools: Read, Grep, Glob
---

# API Documentation для .NET

## Swashbuckle Setup

### Установка

```bash
dotnet add package Swashbuckle.AspNetCore
dotnet add package Swashbuckle.AspNetCore.Annotations
```

### Базовая конфигурация

```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API для управления заказами",
        Contact = new OpenApiContact
        {
            Name = "API Support",
            Email = "api@example.com",
            Url = new Uri("https://example.com/support")
        },
        License = new OpenApiLicense
        {
            Name = "MIT",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });
});

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "My API v1");
    options.RoutePrefix = string.Empty;  // Swagger UI на корне
});
```

## XML Documentation

### Включение в .csproj

```xml
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>
</PropertyGroup>
```

### Подключение XML комментариев

```csharp
builder.Services.AddSwaggerGen(options =>
{
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));
});
```

### Документирование контроллеров

```csharp
/// <summary>
/// Управление продуктами
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    /// <summary>
    /// Получить список продуктов
    /// </summary>
    /// <param name="page">Номер страницы (начиная с 1)</param>
    /// <param name="pageSize">Размер страницы (1-100)</param>
    /// <param name="search">Поиск по названию</param>
    /// <returns>Список продуктов</returns>
    /// <response code="200">Список продуктов</response>
    /// <response code="400">Неверные параметры запроса</response>
    [HttpGet]
    [ProducesResponseType(typeof(ProductListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductListResponse>> GetProducts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        // ...
    }

    /// <summary>
    /// Создать новый продукт
    /// </summary>
    /// <param name="request">Данные нового продукта</param>
    /// <returns>Созданный продукт</returns>
    /// <response code="201">Продукт успешно создан</response>
    /// <response code="400">Ошибка валидации</response>
    /// <response code="409">Продукт с таким названием уже существует</response>
    [HttpPost]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductResponse>> CreateProduct(
        [FromBody] CreateProductRequest request)
    {
        // ...
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, response);
    }
}
```

## Swagger Annotations

```csharp
using Swashbuckle.AspNetCore.Annotations;

[HttpPost]
[SwaggerOperation(
    Summary = "Создать заказ",
    Description = "Создаёт новый заказ для указанного клиента",
    OperationId = "CreateOrder",
    Tags = new[] { "Orders" })]
[SwaggerResponse(201, "Заказ создан", typeof(OrderResponse))]
[SwaggerResponse(400, "Ошибка валидации", typeof(ValidationProblemDetails))]
public async Task<ActionResult<OrderResponse>> CreateOrder(
    [FromBody, SwaggerRequestBody("Данные заказа", Required = true)]
    CreateOrderRequest request)
{
    // ...
}
```

## JWT Authentication в Swagger

```csharp
builder.Services.AddSwaggerGen(options =>
{
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
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
```

## API Versioning

### Установка

```bash
dotnet add package Asp.Versioning.Mvc
dotnet add package Asp.Versioning.Mvc.ApiExplorer
```

### Конфигурация

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new HeaderApiVersionReader("X-API-Version"),
        new QueryStringApiVersionReader("api-version"));
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// Swagger для каждой версии
builder.Services.AddSwaggerGen(options =>
{
    var provider = builder.Services.BuildServiceProvider()
        .GetRequiredService<IApiVersionDescriptionProvider>();

    foreach (var description in provider.ApiVersionDescriptions)
    {
        options.SwaggerDoc(description.GroupName, new OpenApiInfo
        {
            Title = $"My API {description.ApiVersion}",
            Version = description.ApiVersion.ToString(),
            Description = description.IsDeprecated
                ? "This API version has been deprecated."
                : "API documentation"
        });
    }
});

// Swagger UI
app.UseSwaggerUI(options =>
{
    var provider = app.Services.GetRequiredService<IApiVersionDescriptionProvider>();
    foreach (var description in provider.ApiVersionDescriptions.Reverse())
    {
        options.SwaggerEndpoint(
            $"/swagger/{description.GroupName}/swagger.json",
            description.GroupName.ToUpperInvariant());
    }
});
```

### Версионирование контроллеров

```csharp
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ProductsController : ControllerBase
{
    // GET /api/v1/products
}

[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ProductsV2Controller : ControllerBase
{
    // GET /api/v2/products
}

// Устаревшая версия
[ApiController]
[ApiVersion("1.0", Deprecated = true)]
[Route("api/v{version:apiVersion}/legacy")]
public class LegacyController : ControllerBase { }
```

## NSwag Client Generation

### Установка CLI

```bash
dotnet tool install -g NSwag.ConsoleCore
```

### Генерация C# клиента

```bash
nswag openapi2csclient \
  /input:http://localhost:5000/swagger/v1/swagger.json \
  /output:MyApiClient.cs \
  /namespace:MyApp.Client \
  /generateClientInterfaces:true \
  /useBaseUrl:false
```

### Генерация TypeScript клиента

```bash
nswag openapi2tsclient \
  /input:http://localhost:5000/swagger/v1/swagger.json \
  /output:api-client.ts \
  /template:Axios
```

## Model Examples

```csharp
/// <summary>
/// Запрос на создание продукта
/// </summary>
/// <example>
/// {
///   "name": "Ноутбук",
///   "description": "Игровой ноутбук",
///   "price": 99999.99
/// }
/// </example>
public record CreateProductRequest(
    /// <summary>Название продукта</summary>
    /// <example>Ноутбук</example>
    string Name,

    /// <summary>Описание продукта</summary>
    /// <example>Игровой ноутбук с RTX 4080</example>
    string? Description,

    /// <summary>Цена в рублях</summary>
    /// <example>99999.99</example>
    decimal Price
);
```

## Schema Filters

```csharp
// Добавление примеров для enum
public class EnumSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type.IsEnum)
        {
            schema.Enum.Clear();
            foreach (var name in Enum.GetNames(context.Type))
            {
                schema.Enum.Add(new OpenApiString(name));
            }
        }
    }
}

// Регистрация
options.SchemaFilter<EnumSchemaFilter>();
```

## Best Practices

1. **Документируйте все публичные endpoints**
2. **Используйте `[ProducesResponseType]` для всех возможных ответов**
3. **Добавляйте примеры в XML комментарии**
4. **Группируйте endpoints по тегам**
5. **Версионируйте API с первого дня**
6. **Генерируйте клиенты автоматически в CI/CD**
