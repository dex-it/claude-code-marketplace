---
name: api-development
description: ASP.NET Core Web API — ошибки проектирования, безопасность, контракты. Активируется при web api, controller, endpoint, REST API, versioning, swagger, openapi, swashbuckle
allowed-tools: Read, Grep, Glob
---

# API Development

## Правила

- Тонкие контроллеры — только маршрутизация, логика в сервисах/handlers
- CancellationToken в каждом endpoint
- Валидация через FluentValidation pipeline, не в контроллерах
- ProblemDetails для ошибок (RFC 7807)
- API versioning с первого дня
- Не возвращай Entity — только DTO/response models
- ActionResult\<T\> вместо IActionResult — type info для Swagger
- `[ProducesResponseType]` для всех HTTP status codes
- XML comments + `<example>` на request/response models

## Анти-паттерны

```csharp
// Плохо — толстый контроллер с бизнес-логикой
[HttpPost]
public async Task<ActionResult> Create(CreateOrderRequest request)
{
    if (request.Items.Count == 0) return BadRequest("No items"); // валидация в контроллере
    var order = new Order();                                      // создание entity
    order.Total = request.Items.Sum(i => i.Price * i.Quantity);  // бизнес-логика
    _context.Orders.Add(order);                                   // прямой доступ к DbContext
    await _context.SaveChangesAsync();
    return Ok(order);                                             // возвращает Entity + 200 вместо 201
}

// Хорошо — контроллер только маршрутизирует
[HttpPost]
public async Task<ActionResult<OrderDto>> Create(
    CreateOrderRequest request, CancellationToken ct)
{
    var result = await _mediator.Send(new CreateOrderCommand(request), ct);
    return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
}

// Плохо — try/catch в каждом контроллере
[HttpGet("{id}")]
public async Task<ActionResult<OrderDto>> GetById(int id, CancellationToken ct)
{
    try {
        var order = await _service.GetAsync(id, ct);
        return Ok(order);
    }
    catch (NotFoundException) { return NotFound(); }
    catch (Exception ex) { return StatusCode(500, ex.Message); } // стектрейс клиенту!
}
// Копипаста try/catch в каждом методе, нет единого формата

// Хорошо — единый exception handler middleware
// Контроллер просто кидает исключение, middleware ловит и форматирует в ProblemDetails

// Плохо — IActionResult теряет type info для Swagger
[HttpGet("{id}")]
public async Task<IActionResult> GetById(int id, CancellationToken ct)
{
    return Ok(await _service.GetAsync(id, ct));
}
// Swagger не знает тип ответа → генерация клиентов невозможна

// Хорошо — ActionResult<T> + ProducesResponseType
/// <response code="200">Заказ найден</response>
/// <response code="404">Заказ не найден</response>
[HttpGet("{id}")]
[ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<ActionResult<OrderDto>> GetById(int id, CancellationToken ct)
{
    var order = await _service.GetAsync(id, ct);
    if (order is null) return NotFound();
    return Ok(order);
}

// Плохо — возвращает Entity напрямую (утечка внутренней структуры)
return Ok(await _context.Users.FindAsync(id));
// Клиент видит: PasswordHash, InternalFlags, навигационные свойства...

// Хорошо — DTO
return Ok(new UserDto(user.Id, user.Name, user.Email));

// Плохо — async void в контроллере
[HttpPost]
public async void Create(CreateOrderRequest request) // async void!
{
    await _service.CreateAsync(request);
    // Исключение молча проглатывается — 200 OK, а заказ не создан
    // Caller не может await — нет Task, нет CancellationToken
}

// Плохо — дублированный путь на каждом методе
[HttpGet("api/orders/{id}")]
public async Task<ActionResult<OrderDto>> GetById(int id, CancellationToken ct) { }

[HttpPost("api/orders")]
public async Task<ActionResult<OrderDto>> Create(CreateOrderRequest req, CancellationToken ct) { }
// "api/orders" повторяется, при переименовании — забудешь один метод

// Хорошо — Route на контроллере
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase { }
```

## Пагинация — не забывай

```csharp
// Плохо — возвращает все записи
[HttpGet]
public async Task<ActionResult<List<ProductDto>>> GetAll(CancellationToken ct)
    => Ok(await _context.Products.ToListAsync(ct)); // 100K записей в ответ

// Хорошо — пагинация обязательна для списков
[HttpGet]
public async Task<ActionResult<PagedResult<ProductDto>>> GetAll(
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20,
    CancellationToken ct = default)
{
    pageSize = Math.Clamp(pageSize, 1, 100); // ограничь максимум
    // ...
}
```

## Swagger — частые ошибки

```csharp
// Плохо — XML comments не видны в Swagger
// Забыли в .csproj:
// <GenerateDocumentationFile>true</GenerateDocumentationFile>
// Все <summary> и <example> молча игнорируются

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

// Плохо — internal endpoints видны в публичном Swagger
[HttpPost("internal/recalculate")]
public async Task<ActionResult> Recalculate(CancellationToken ct) { }
// Внутренний endpoint для межсервисного вызова — клиенты его видят

// Хорошо — скрыть внутренние endpoints
[HttpPost("internal/recalculate")]
[ApiExplorerSettings(IgnoreApi = true)]
public async Task<ActionResult> Recalculate(CancellationToken ct) { }
```

## Чек-лист

- [ ] Контроллеры тонкие — нет бизнес-логики
- [ ] CancellationToken в каждом endpoint (не async void!)
- [ ] Валидация через pipeline, не в контроллерах
- [ ] ActionResult\<T\>, не IActionResult
- [ ] `[ProducesResponseType]` на каждом endpoint
- [ ] POST возвращает 201 + Location
- [ ] Списки с пагинацией и лимитом pageSize
- [ ] Единый exception handler (не try/catch в каждом методе)
- [ ] Не возвращаются Entity — только DTO
- [ ] `[Route("api/[controller]")]` на контроллере, не пути на методах
- [ ] `GenerateDocumentationFile` в .csproj
- [ ] XML `<example>` на request/response models
- [ ] Internal endpoints скрыты (`[ApiExplorerSettings(IgnoreApi = true)]`)
