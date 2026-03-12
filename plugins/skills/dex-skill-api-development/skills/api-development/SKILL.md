---
name: api-development
description: ASP.NET Core Web API — ошибки проектирования, безопасность, контракты. Активируется при web api, controller, endpoint, REST API, versioning
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
- CreatedAtAction для POST (201 + Location header)

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

// Плохо — исключение для бизнес-ошибки (404)
var order = await _repo.GetByIdAsync(id, ct);
if (order == null) throw new Exception("Not found"); // stack trace для штатной ситуации

// Хорошо — Result pattern или просто NotFound()
var order = await _repo.GetByIdAsync(id, ct);
if (order is null) return NotFound();

// Плохо — возвращает Entity напрямую (утечка внутренней структуры)
return Ok(await _context.Users.FindAsync(id));
// Клиент видит: PasswordHash, InternalFlags, навигационные свойства...

// Хорошо — DTO
return Ok(new UserDto(user.Id, user.Name, user.Email));
```

## Обработка ошибок — единый формат

```csharp
// Middleware + ProblemDetails — НЕ дублируй try/catch в каждом контроллере
app.UseExceptionHandler(app => app.Run(async context =>
{
    var ex = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var (status, title) = ex switch
    {
        NotFoundException => (404, "Not Found"),
        ValidationException => (400, "Validation Error"),
        _ => (500, "Internal Server Error")
    };

    context.Response.StatusCode = status;
    await context.Response.WriteAsJsonAsync(new ProblemDetails
    {
        Status = status,
        Title = title,
        Detail = status == 500 ? null : ex?.Message // не показывай стектрейс клиенту
    });
}));
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

## Чек-лист

- [ ] Контроллеры тонкие — нет бизнес-логики
- [ ] CancellationToken в каждом endpoint
- [ ] Валидация через pipeline, не в контроллерах
- [ ] POST возвращает 201 + Location
- [ ] Списки с пагинацией и лимитом pageSize
- [ ] Единый формат ошибок (ProblemDetails)
- [ ] Не возвращаются Entity — только DTO
- [ ] API versioned
