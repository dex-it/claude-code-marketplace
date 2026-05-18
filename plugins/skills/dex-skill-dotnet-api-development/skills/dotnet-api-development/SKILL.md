---
name: dotnet-api-development
description: ASP.NET Core Web API — ловушки контроллеров, DTO, URL, пагинации. Активируется при web api, controller, endpoint, REST, route, FromQuery, FromRoute, path, query parameter, versioning, swagger, ActionResult, ProblemDetails, CreatedAtAction, middleware
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

## URL design

### Обязательные идентификаторы ресурса в query вместо path
Плохо: `GET /api/items?ownerId=123&itemNumber=10` — без обоих параметров запрос бессмыслен
Правильно: `GET /api/owners/{ownerId}/items/{itemNumber}` — идентификаторы в path, иерархия отражена
Почему: обязательный `[FromQuery][Required]` — сигнал, что параметр должен быть path. Path-идентификаторы кэшируются CDN/прокси, лучше генерируются клиентами (Refit, OpenAPI codegen), читаются как естественный URL ресурса

### Фильтры и пагинация в path вместо query
Плохо: `GET /api/orders/2024/01/active/page/2` — фильтры и пагинация вшиты в путь
Правильно: `GET /api/orders?status=active&from=2024-01-01&page=2` — опциональные параметры в query
Почему: path описывает **что** за ресурс, query — **как** его отфильтровать/срезать. Путаница ролей ломает кэширование, усложняет генерацию клиента, мешает добавлять новые фильтры без breaking change

### URL не отражает иерархию ресурсов
Плохо: `GET /api/get-project-items?project=X&item=Y` — плоский URL с глаголом и фильтрами
Правильно: `GET /api/projects/{projectId}/items/{itemId}` — иерархия ресурсов, без глаголов
Почему: REST-URL описывает ресурс существительным, иерархия родитель→ребёнок кодирует bonded lookup. Глаголы в URL (`get-`, `fetch-`, `do-`) — RPC-стиль, нарушает кэширование и semantic клиентов

### Несогласованность с существующими эндпоинтами сервиса
Плохо: один контроллер использует `/api/users/{id}`, другой — `/api/v1/user-list?userId=`
Правильно: одна схема URL во всём сервисе — одинаковое versioning, плюрализация, casing
Почему: интеграторы учат API по первому эндпоинту и экстраполируют на остальные. Несогласованность = постоянные ошибки в клиенте + рост support-запросов. Это проверяется при ревью каждого нового эндпоинта

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
