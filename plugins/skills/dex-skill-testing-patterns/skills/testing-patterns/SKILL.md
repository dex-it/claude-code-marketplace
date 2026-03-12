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
- Нет DateTime.Now/UtcNow в тестируемом коде — TimeProvider (.NET 8) или IClock

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
// 5 строк setup для одного теста — признак плохого дизайна кода, не теста

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
    var created = await _service.CreateAsync(new CreateUserRequest("Test"), ct);
    var result = await _service.GetByIdAsync(created.Id, ct);
    Assert.NotNull(result);
    Assert.Equal("Test", result.Name);
}

// Плохо — DateTime.Now в тестируемом коде → flaky тесты
public class OrderService
{
    public Order CreateOrder(CreateOrderRequest request)
    {
        return new Order { CreatedAt = DateTime.UtcNow }; // в тесте время непредсказуемо
    }
}
// Тест: Assert.Equal(expectedDate, order.CreatedAt) — иногда падает на CI

// Хорошо — TimeProvider инъецируется
public class OrderService(TimeProvider timeProvider)
{
    public Order CreateOrder(CreateOrderRequest request)
    {
        return new Order { CreatedAt = timeProvider.GetUtcNow() };
    }
}
// В тесте: new FakeTimeProvider(new DateTimeOffset(2024, 1, 1, ...))

// Плохо — Task.Delay / Thread.Sleep в тестах
[Fact]
public async Task BackgroundJob_ProcessesMessage()
{
    await _service.EnqueueAsync(message);
    await Task.Delay(2000); // "подождём пока обработает"
    var result = await _service.GetStatusAsync(message.Id);
    Assert.Equal("Processed", result);
    // Flaky: на медленном CI 2 секунд не хватит, на быстром — лишнее ожидание
}

// Хорошо — polling с таймаутом
[Fact]
public async Task BackgroundJob_ProcessesMessage()
{
    await _service.EnqueueAsync(message);
    var result = await WaitForConditionAsync(
        () => _service.GetStatusAsync(message.Id),
        status => status == "Processed",
        timeout: TimeSpan.FromSeconds(10));
    Assert.Equal("Processed", result);
}
```

## Theory — когда НЕ использовать

```csharp
// Хорошо — Theory для параметризованных данных с одинаковым Arrange
[Theory]
[InlineData("", false)]
[InlineData("valid@email.com", true)]
[InlineData("no-at-sign", false)]
public void IsValidEmail_ReturnsExpected(string email, bool expected)
{
    Assert.Equal(expected, _validator.IsValid(email));
}

// Плохо — Theory когда Arrange сильно отличается
[Theory]
[InlineData("admin", true, true, false)]   // что значат эти bool?
[InlineData("user", false, false, true)]
[InlineData("guest", false, false, false)]
public void CheckPermissions(string role, bool canEdit, bool canDelete, bool needsApproval)
{
    // Нечитаемо — нужны отдельные Fact тесты с говорящими именами
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
- [ ] Нет DateTime.Now в тестируемом коде — TimeProvider/IClock
- [ ] Нет Thread.Sleep/Task.Delay — polling с таймаутом
