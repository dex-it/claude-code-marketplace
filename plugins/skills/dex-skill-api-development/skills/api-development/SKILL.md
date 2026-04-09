---
name: api-development
description: ASP.NET Core Web API — ловушки контроллеров, DTO, пагинации. Активируется при web api, controller, endpoint, REST API, versioning, swagger, openapi, ActionResult, ProblemDetails, CreatedAtAction, ProducesResponseType, exception handler, middleware
---

# API Development — ловушки и anti-patterns

## Контроллеры

### Толстый контроллер с бизнес-логикой
Плохо: валидация, создание entity, вычисления, прямой DbContext — всё в одном action
Правильно: контроллер только маршрутизирует → `_mediator.Send()` или service
Почему: нарушает SRP, невозможно тестировать без HTTP pipeline, дублирование при добавлении gRPC/GraphQL

### try/catch в каждом контроллере
Плохо: копипаста `try { } catch (NotFoundException) { return NotFound(); } catch (Exception) { return 500; }` в каждом action
Правильно: единый exception handler middleware → ProblemDetails (RFC 7807)
Почему: `catch (Exception ex) { return StatusCode(500, ex.Message) }` — стектрейс клиенту. Копипаста → inconsistent error format

### IActionResult вместо ActionResult\<T\>
Плохо: `Task<IActionResult>` — Swagger не знает тип ответа
Правильно: `Task<ActionResult<OrderDto>>` + `[ProducesResponseType(typeof(ProblemDetails), 404)]`
Почему: NSwag/Kiota не могут сгенерировать типизированный клиент. Без ProducesResponseType Swagger показывает только 200

### Возвращает Entity вместо DTO
Плохо: `return Ok(await _context.Users.FindAsync(id))` — клиент видит PasswordHash, InternalFlags
Правильно: DTO с нужными полями: `new UserDto(user.Id, user.Name, user.Email)`
Почему: утечка внутренней структуры БД, навигационные свойства тянут связанные данные, изменение схемы ломает API контракт

### async void в контроллере
Плохо: `public async void Create(...)` — исключение проглатывается, 200 OK отправляется до завершения
Правильно: `public async Task<ActionResult<T>> Create(..., CancellationToken ct)`
Почему: async void = fire-and-forget. Caller не получает ошибку, CancellationToken невозможен

### Дублированный путь на методах
Плохо: `[HttpGet("api/orders/{id}")]` + `[HttpPost("api/orders")]` — "api/orders" повторяется
Правильно: `[Route("api/[controller]")]` на контроллере
Почему: при переименовании забудешь один метод → 404 в production

### POST возвращает 200 вместо 201
Плохо: `return Ok(order)` после создания
Правильно: `return CreatedAtAction(nameof(GetById), new { id = order.Id }, order)` — 201 + Location header
Почему: REST клиенты полагаются на 201 для проверки создания и Location для навигации

## Пагинация

### Возвращает все записи
Плохо: `Products.ToListAsync()` без лимита — 100K записей в ответ
Правильно: `[FromQuery] int page, int pageSize` + `Math.Clamp(pageSize, 1, 100)` — ограничь максимум
Почему: один запрос без пагинации → OOM, timeout, огромный JSON response. Клиент может запросить pageSize=1000000

## Swagger

### XML comments не видны
Плохо: написал `<summary>` на моделях, но Swagger их не показывает — забыл `GenerateDocumentationFile`
Правильно: `<GenerateDocumentationFile>true</GenerateDocumentationFile>` в .csproj
Почему: без этого флага компилятор не генерирует XML. Swashbuckle молча игнорирует — ни ошибки, ни warning

### Internal endpoints видны в публичном Swagger
Плохо: `/internal/recalculate` виден всем потребителям API
Правильно: `[ApiExplorerSettings(IgnoreApi = true)]`
Почему: утечка внутренней архитектуры, злоумышленник видит internal endpoints
