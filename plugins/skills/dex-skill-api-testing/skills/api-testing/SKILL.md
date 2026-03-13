---
name: api-testing
description: API тестирование — ловушки, пропущенные сценарии. Активируется при api testing, rest api test, integration tests, contract testing
---

# API Testing — ловушки

## Правила

- WebApplicationFactory + реальная БД (Testcontainers), не InMemory
- Каждый тест создаёт свои данные и чистит за собой
- Тестируй контракт (status codes, headers, response schema), не реализацию
- Auth тесты: 401 (нет токена), 403 (нет прав), не только 200
- Idempotency: повторный PUT/DELETE — тот же результат

## Частые ошибки

```csharp
// Плохо — InMemoryDatabase вместо реальной БД
builder.ConfigureServices(services =>
{
    services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("Test"));
});
// InMemory не поддерживает: транзакции, constraints, SQL-специфичные запросы
// Тест зелёный, production красный

// Хорошо — Testcontainers
builder.ConfigureServices(services =>
{
    services.AddDbContext<AppDbContext>(o =>
        o.UseNpgsql(_postgres.GetConnectionString()));
});

// Плохо — тест без проверки Location header на POST
[Fact]
public async Task CreateOrder_ShouldReturn201()
{
    var response = await _client.PostAsJsonAsync("/api/orders", request);
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    // А Location header? Без него клиент не знает URL нового ресурса
}

// Хорошо — проверяй контракт полностью
[Fact]
public async Task CreateOrder_ShouldReturn201WithLocation()
{
    var response = await _client.PostAsJsonAsync("/api/orders", request);
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    Assert.NotNull(response.Headers.Location);
    // И убедись что Location реально работает:
    var getResponse = await _client.GetAsync(response.Headers.Location);
    Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
}

// Плохо — тестируют только happy path (200 OK)
// Пропущены: 400, 401, 403, 404, 409, 422

// Хорошо — матрица status codes
// GET    /orders/{id}  → 200, 401, 403, 404
// POST   /orders       → 201, 400, 401, 409
// PUT    /orders/{id}  → 200, 400, 401, 403, 404, 409
// DELETE /orders/{id}  → 204, 401, 403, 404

// Плохо — shared state между тестами
public class OrderTests : IClassFixture<WebApplicationFactory<Program>>
{
    private static int _createdOrderId; // static! один тест создаёт, другой читает

    [Fact] public async Task CreateOrder() { _createdOrderId = ...; }
    [Fact] public async Task GetOrder() { await _client.GetAsync($"/api/orders/{_createdOrderId}"); }
    // Порядок выполнения не гарантирован → flaky
}

// Плохо — не тестируют concurrent access
// Два пользователя одновременно обновляют заказ → один перезаписывает другого

// Хорошо — тест на optimistic concurrency
[Fact]
public async Task UpdateOrder_ConcurrentUpdate_ShouldReturn409()
{
    var order = await CreateOrderAsync();

    // Два "пользователя" читают одну версию
    var response1 = await _client.GetAsync($"/api/orders/{order.Id}");
    var response2 = await _client.GetAsync($"/api/orders/{order.Id}");
    var version1 = await response1.Content.ReadFromJsonAsync<OrderDto>();
    var version2 = await response2.Content.ReadFromJsonAsync<OrderDto>();

    // Первый обновляет успешно
    var update1 = await _client.PutAsJsonAsync($"/api/orders/{order.Id}", version1);
    Assert.Equal(HttpStatusCode.OK, update1.StatusCode);

    // Второй получает 409 Conflict (stale version)
    var update2 = await _client.PutAsJsonAsync($"/api/orders/{order.Id}", version2);
    Assert.Equal(HttpStatusCode.Conflict, update2.StatusCode);
}

// Плохо — не проверяют ProblemDetails формат ошибки
var response = await _client.PostAsJsonAsync("/api/orders", invalidRequest);
Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
// А что в теле? Строка "Bad Request"? JSON? HTML? Клиент не сможет парсить

// Хорошо — проверяй формат ошибки
var response = await _client.PostAsJsonAsync("/api/orders", invalidRequest);
Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
Assert.NotNull(problem);
Assert.Contains("Items", problem!.Errors.Keys); // конкретное поле с ошибкой
```

## Пропускаемые сценарии

| Сценарий | Почему важно |
|----------|-------------|
| Пагинация: page=0, page=-1, pageSize=0 | Часто нет валидации → 500 |
| Пустой список: GET /orders когда 0 записей | Возвращает null вместо [] |
| Trailing slash: /api/orders/ vs /api/orders | Могут быть разные routes |
| Content-Type отсутствует | 415 Unsupported Media Type? Или 500? |
| Очень большой payload | Нет лимита → OOM |
| SQL injection в query params | ?search='; DROP TABLE-- |
| Idempotency: DELETE уже удалённого | 404? 204? Должно быть одинаково |

## Чек-лист

- [ ] Testcontainers, не InMemoryDatabase
- [ ] POST: проверяется 201 + Location header + GET по Location
- [ ] Все error status codes протестированы (400, 401, 403, 404, 409)
- [ ] Ошибки возвращают ProblemDetails (не строки, не HTML)
- [ ] Тесты изолированы — нет shared state
- [ ] Concurrent access → 409 Conflict
- [ ] Пагинация: невалидные page/pageSize
- [ ] Пустые коллекции: [] а не null
- [ ] Auth: без токена → 401, без прав → 403
