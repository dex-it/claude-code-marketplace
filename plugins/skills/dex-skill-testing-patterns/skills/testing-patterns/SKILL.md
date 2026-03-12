---
name: testing-patterns
description: Паттерны тестирования — ошибки, антипаттерны, стратегии. Активируется при test, unit test, xunit, moq, testing, integration test
allowed-tools: Read, Grep, Glob
---

# Testing Patterns

## Правила

- Именование: `MethodName_Scenario_ExpectedBehavior`
- AAA: Arrange / Act / Assert — одно действие, один assert-блок
- Не тестируй приватные методы — тестируй поведение через публичный API
- Моки только для внешних зависимостей (DB, HTTP, MQ) — не мокай бизнес-логику
- Тесты не зависят друг от друга — нет общего состояния
- CancellationToken.None в тестах, не default

## Анти-паттерны

```csharp
// Плохо — тест проверяет реализацию, а не поведение
[Fact]
public async Task CreateOrder_CallsRepositoryAdd()
{
    await _service.CreateOrderAsync(request, CancellationToken.None);
    _mockRepo.Verify(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Once);
    // Тест сломается при рефакторинге, хотя поведение не изменилось
}

// Хорошо — тест проверяет результат
[Fact]
public async Task CreateOrder_ReturnsCreatedOrder()
{
    var result = await _service.CreateOrderAsync(request, CancellationToken.None);
    Assert.True(result.IsSuccess);
    Assert.Equal(request.CustomerId, result.Value.CustomerId);
}

// Плохо — несколько действий в одном тесте
[Fact]
public async Task OrderLifecycle_CreateUpdateDelete()
{
    var order = await _service.CreateAsync(request, ct);  // Act 1
    await _service.UpdateAsync(order.Id, update, ct);     // Act 2
    await _service.DeleteAsync(order.Id, ct);             // Act 3
    // Какой Act упал? Непонятно
}

// Плохо — Assert.True вместо конкретного assert
Assert.True(result.Name == "Expected"); // "Assert.True() Failure" — бесполезное сообщение

// Хорошо — конкретный assert с понятным сообщением
Assert.Equal("Expected", result.Name); // "Expected: Expected, Actual: Wrong" — понятно

// Плохо — мок возвращает мок (chain of mocks)
var mockUoW = new Mock<IUnitOfWork>();
var mockRepo = new Mock<IOrderRepository>();
mockUoW.Setup(u => u.Orders).Returns(mockRepo.Object);
mockRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order());
// 5 строк setup для одного теста — признак плохого дизайна

// Плохо — тест зависит от внешнего состояния
[Fact]
public async Task GetUser_ReturnsUser()
{
    var user = await _service.GetByIdAsync(42, ct); // а кто создал user 42?
    Assert.NotNull(user);
}

// Хорошо — тест создаёт свои данные
[Fact]
public async Task GetUser_ExistingUser_ReturnsUser()
{
    // Arrange
    var created = await _service.CreateAsync(new CreateUserRequest("Test"), ct);

    // Act
    var result = await _service.GetByIdAsync(created.Id, ct);

    // Assert
    Assert.NotNull(result);
    Assert.Equal("Test", result.Name);
}
```

## Когда integration тесты вместо unit

- Repository/DbContext — `WebApplicationFactory` + реальная БД (Testcontainers)
- HTTP pipeline — middleware, filters, auth
- Сложные LINQ запросы — in-memory provider врёт, нужен реальный SQL

```csharp
// Integration test с WebApplicationFactory
public class OrdersApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateOrder_Returns201()
    {
        var response = await _client.PostAsJsonAsync("/api/orders", new { CustomerId = 1 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
    }
}
```

## Чек-лист

- [ ] Тесты проверяют поведение, не реализацию
- [ ] Один Act на тест
- [ ] Конкретные Assert (Equal, NotNull), не Assert.True
- [ ] Тесты изолированы — нет shared state
- [ ] Integration тесты для DB/HTTP — не in-memory fakes
- [ ] Нет моков бизнес-логики — только внешние зависимости
