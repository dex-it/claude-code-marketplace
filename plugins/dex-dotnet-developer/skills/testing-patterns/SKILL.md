---
name: testing-patterns
description: Паттерны unit тестирования - xUnit, Moq, AAA pattern. Активируется при test, unit test, xunit, moq, testing
allowed-tools: Read, Grep, Glob
---

# Testing Patterns

## Структура теста (AAA)

```csharp
[Fact]
public async Task MethodName_Scenario_ExpectedBehavior()
{
    // Arrange - подготовка
    var input = new TestInput();

    // Act - действие
    var result = await _service.MethodAsync(input);

    // Assert - проверка
    Assert.True(result.IsSuccess);
}
```

## xUnit Attributes

```csharp
[Fact]  // Один тест
public void SimpleTest() { }

[Theory]  // Параметризованный тест
[InlineData("", false)]
[InlineData("valid@email.com", true)]
public void ValidateEmail_ReturnsExpected(string email, bool expected)
{
    Assert.Equal(expected, EmailValidator.IsValid(email));
}

[Theory]
[MemberData(nameof(TestCases))]
public void Test_WithMemberData(Order order, bool expected) { }

public static IEnumerable<object[]> TestCases =>
    new List<object[]>
    {
        new object[] { new Order(), false },
        new object[] { new Order { Items = new() }, true }
    };
```

## Moq

### Setup

```csharp
var mockRepo = new Mock<IProductRepository>();

// Возвращаемое значение
mockRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Product { Id = 1 });

// Для любого аргумента
mockRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync((Product?)null);

// Callback
mockRepo.Setup(r => r.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()))
    .Callback<Product, CancellationToken>((p, ct) => p.Id = 1);

// Throws
mockRepo.Setup(r => r.GetByIdAsync(-1, It.IsAny<CancellationToken>()))
    .ThrowsAsync(new ArgumentException());
```

### Verify

```csharp
// Вызван один раз
mockRepo.Verify(r => r.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()), Times.Once);

// С конкретными аргументами
mockRepo.Verify(r => r.AddAsync(
    It.Is<Product>(p => p.Name == "Test"),
    It.IsAny<CancellationToken>()), Times.Once);

// Не вызывался
mockRepo.Verify(r => r.DeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
```

## Test Fixture

```csharp
public class ProductServiceTests : IDisposable
{
    private readonly Mock<IProductRepository> _mockRepo;
    private readonly Mock<ILogger<ProductService>> _mockLogger;
    private readonly ProductService _service;

    public ProductServiceTests()
    {
        _mockRepo = new Mock<IProductRepository>();
        _mockLogger = new Mock<ILogger<ProductService>>();
        _service = new ProductService(_mockRepo.Object, _mockLogger.Object);
    }

    public void Dispose()
    {
        // Cleanup if needed
    }

    [Fact]
    public async Task CreateProduct_Success()
    {
        // Use _service, _mockRepo...
    }
}
```

## Assertions

```csharp
// Basic
Assert.True(condition);
Assert.False(condition);
Assert.Null(value);
Assert.NotNull(value);
Assert.Equal(expected, actual);

// Collections
Assert.Empty(collection);
Assert.NotEmpty(collection);
Assert.Contains(item, collection);
Assert.Single(collection);
Assert.All(collection, item => Assert.True(item.IsValid));

// Exceptions
await Assert.ThrowsAsync<ArgumentException>(
    () => _service.InvalidOperationAsync());

var ex = await Assert.ThrowsAsync<ValidationException>(
    () => _service.ValidateAsync(null));
Assert.Contains("required", ex.Message);

// Type
Assert.IsType<OrderDto>(result);
Assert.IsAssignableFrom<IEntity>(result);
```

## FluentAssertions (альтернатива)

```csharp
result.Should().NotBeNull();
result.Name.Should().Be("Expected");
result.Items.Should().HaveCount(3);
result.Price.Should().BeGreaterThan(0);

await action.Should().ThrowAsync<ArgumentException>()
    .WithMessage("*invalid*");
```
