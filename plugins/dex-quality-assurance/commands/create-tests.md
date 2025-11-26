---
description: Генерация автоматизированных тестов (xUnit, Playwright, API)
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
argument-hint: [test-type] [file-or-class]
---

# /create-tests

Команда для генерации автоматизированных тестов на основе тест-кейсов или существующего кода.

## Использование

```bash
/create-tests                              # Интерактивный режим
/create-tests unit OrderService            # Unit тесты для класса
/create-tests api /api/orders              # API тесты для endpoint
/create-tests e2e checkout                 # E2E тесты для flow
/create-tests integration OrderRepository  # Integration тесты
```

## Типы тестов

### 1. Unit Tests (xUnit)

```bash
/create-tests unit src/Domain/Order.cs
```

**Генерирует:**

```csharp
// tests/Domain.Tests/OrderTests.cs
using Xunit;
using FluentAssertions;

namespace YourApp.Domain.Tests;

public class OrderTests
{
    [Fact]
    public void Create_WithValidData_ShouldCreateOrder()
    {
        // Arrange
        var customerId = 123;
        var items = new List<OrderItem>
        {
            new(productId: 1, quantity: 2, price: 100m)
        };

        // Act
        var order = Order.Create(customerId, items);

        // Assert
        order.Should().NotBeNull();
        order.CustomerId.Should().Be(customerId);
        order.Items.Should().HaveCount(1);
        order.TotalAmount.Should().Be(200m);
        order.Status.Should().Be(OrderStatus.Pending);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Create_WithInvalidCustomerId_ShouldThrowException(int invalidId)
    {
        // Arrange & Act
        var act = () => Order.Create(invalidId, new List<OrderItem>());

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("Customer ID must be positive");
    }

    [Fact]
    public void AddItem_WhenOrderIsCompleted_ShouldThrowException()
    {
        // Arrange
        var order = Order.Create(123, new List<OrderItem>());
        order.Complete();

        // Act
        var act = () => order.AddItem(new OrderItem(1, 1, 100m));

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Cannot modify completed order");
    }

    [Fact]
    public void CalculateTotal_WithMultipleItems_ShouldReturnCorrectSum()
    {
        // Arrange
        var order = Order.Create(123, new List<OrderItem>
        {
            new(1, 2, 100m), // 200
            new(2, 1, 50m),  // 50
            new(3, 3, 25m)   // 75
        });

        // Act
        var total = order.CalculateTotal();

        // Assert
        total.Should().Be(325m);
    }
}
```

### 2. API Tests (Integration)

```bash
/create-tests api src/Api/Controllers/OrdersController.cs
```

**Генерирует:**

```csharp
// tests/Api.Tests/OrdersControllerTests.cs
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;
using Xunit;
using FluentAssertions;

namespace YourApp.Api.Tests;

public class OrdersControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateOrder_WithValidData_ShouldReturn201()
    {
        // Arrange
        var request = new CreateOrderRequest(
            CustomerId: 123,
            Items: new List<OrderItemDto>
            {
                new(ProductId: 1, Quantity: 2)
            }
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
        order.Should().NotBeNull();
        order!.Id.Should().BeGreaterThan(0);
        order.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task CreateOrder_WithInvalidData_ShouldReturn400()
    {
        // Arrange
        var request = new CreateOrderRequest(
            CustomerId: 0, // Invalid
            Items: new List<OrderItemDto>()
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        error!.Errors.Should().ContainKey("CustomerId");
    }

    [Fact]
    public async Task GetOrder_WhenExists_ShouldReturn200()
    {
        // Arrange
        var orderId = await CreateTestOrderAsync();

        // Act
        var response = await _client.GetAsync($"/api/orders/{orderId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
        order.Should().NotBeNull();
        order!.Id.Should().Be(orderId);
    }

    [Fact]
    public async Task GetOrder_WhenNotExists_ShouldReturn404()
    {
        // Act
        var response = await _client.GetAsync("/api/orders/999999");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CancelOrder_WhenPending_ShouldReturn200()
    {
        // Arrange
        var orderId = await CreateTestOrderAsync();

        // Act
        var response = await _client.PostAsync($"/api/orders/{orderId}/cancel", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
        order!.Status.Should().Be("Cancelled");
    }

    private async Task<int> CreateTestOrderAsync()
    {
        var request = new CreateOrderRequest(123, new List<OrderItemDto>
        {
            new(1, 1)
        });
        var response = await _client.PostAsJsonAsync("/api/orders", request);
        var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
        return order!.Id;
    }
}
```

### 3. E2E Tests (Playwright)

```bash
/create-tests e2e checkout-flow
```

**Генерирует:**

```csharp
// tests/E2E.Tests/CheckoutFlowTests.cs
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace YourApp.E2E.Tests;

[Parallelizable(ParallelScope.Self)]
public class CheckoutFlowTests : PageTest
{
    private const string BaseUrl = "https://localhost:5001";

    [SetUp]
    public async Task SetUp()
    {
        await Context.Tracing.StartAsync(new()
        {
            Screenshots = true,
            Snapshots = true,
            Sources = true
        });
    }

    [TearDown]
    public async Task TearDown()
    {
        if (TestContext.CurrentContext.Result.Outcome.Status == TestStatus.Failed)
        {
            await Context.Tracing.StopAsync(new()
            {
                Path = $"traces/{TestContext.CurrentContext.Test.Name}.zip"
            });
        }
    }

    [Test]
    public async Task CompleteCheckout_WithValidData_ShouldCreateOrder()
    {
        // Arrange
        await Page.GotoAsync($"{BaseUrl}/");
        await LoginAsTestUserAsync();

        // Act - Add product to cart
        await Page.ClickAsync("[data-test='product-1']");
        await Page.ClickAsync("[data-test='add-to-cart']");
        await Expect(Page.Locator("[data-test='cart-badge']")).ToHaveTextAsync("1");

        // Act - Go to checkout
        await Page.ClickAsync("[data-test='cart-icon']");
        await Page.ClickAsync("[data-test='checkout-button']");

        // Act - Fill shipping info
        await Page.FillAsync("#address", "Москва, ул. Ленина, д. 1");
        await Page.SelectOptionAsync("#delivery-method", "courier");

        // Act - Confirm order
        await Page.ClickAsync("[data-test='confirm-order']");

        // Assert
        await Expect(Page).ToHaveURLAsync($"{BaseUrl}/order/success");
        await Expect(Page.Locator("h1")).ToContainTextAsync("Заказ оформлен");

        var orderNumber = await Page.Locator("[data-test='order-number']").TextContentAsync();
        Assert.That(orderNumber, Does.Match(@"ORDER-\d+"));
    }

    [Test]
    public async Task Checkout_WithEmptyCart_ShouldDisableButton()
    {
        // Arrange
        await Page.GotoAsync($"{BaseUrl}/cart");
        await LoginAsTestUserAsync();

        // Assert
        await Expect(Page.Locator("[data-test='checkout-button']")).ToBeDisabledAsync();
        await Expect(Page.Locator(".empty-cart-message")).ToBeVisibleAsync();
    }

    [Test]
    public async Task Checkout_WithMinimumAmount_ShouldShowShippingCost()
    {
        // Arrange
        await Page.GotoAsync($"{BaseUrl}/");
        await LoginAsTestUserAsync();
        await AddProductToCartAsync(productId: 1, quantity: 1); // 1000 руб

        // Act
        await Page.GotoAsync($"{BaseUrl}/checkout");
        await Page.SelectOptionAsync("#delivery-method", "courier");

        // Assert
        var shippingCost = await Page.Locator("[data-test='shipping-cost']").TextContentAsync();
        Assert.That(shippingCost, Is.EqualTo("300 руб"));

        var total = await Page.Locator("[data-test='total']").TextContentAsync();
        Assert.That(total, Is.EqualTo("1300 руб"));
    }

    [Test]
    public async Task Checkout_WithFreeShippingAmount_ShouldShowZeroCost()
    {
        // Arrange
        await Page.GotoAsync($"{BaseUrl}/");
        await LoginAsTestUserAsync();
        await AddProductToCartAsync(productId: 1, quantity: 5); // 5000 руб

        // Act
        await Page.GotoAsync($"{BaseUrl}/checkout");
        await Page.SelectOptionAsync("#delivery-method", "courier");

        // Assert
        var shippingCost = await Page.Locator("[data-test='shipping-cost']").TextContentAsync();
        Assert.That(shippingCost, Is.EqualTo("0 руб"));

        await Expect(Page.Locator(".free-shipping-badge")).ToBeVisibleAsync();
    }

    private async Task LoginAsTestUserAsync()
    {
        await Page.ClickAsync("[data-test='login-link']");
        await Page.FillAsync("#email", "test@example.com");
        await Page.FillAsync("#password", "Test123!");
        await Page.ClickAsync("[data-test='login-button']");
        await Expect(Page.Locator("[data-test='user-menu']")).ToBeVisibleAsync();
    }

    private async Task AddProductToCartAsync(int productId, int quantity)
    {
        await Page.ClickAsync($"[data-test='product-{productId}']");
        await Page.FillAsync("#quantity", quantity.ToString());
        await Page.ClickAsync("[data-test='add-to-cart']");
        await Expect(Page.Locator("[data-test='cart-badge']")).ToHaveTextAsync(quantity.ToString());
    }
}
```

### 4. Integration Tests (Repository)

```bash
/create-tests integration src/Infrastructure/Repositories/OrderRepository.cs
```

**Генерирует:**

```csharp
// tests/Infrastructure.Tests/OrderRepositoryTests.cs
using Microsoft.EntityFrameworkCore;
using Xunit;
using FluentAssertions;

namespace YourApp.Infrastructure.Tests;

public class OrderRepositoryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly OrderRepository _repository;

    public OrderRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _repository = new OrderRepository(_context);
    }

    [Fact]
    public async Task AddAsync_ShouldAddOrderToDatabase()
    {
        // Arrange
        var order = Order.Create(123, new List<OrderItem>
        {
            new(1, 2, 100m)
        });

        // Act
        await _repository.AddAsync(order, CancellationToken.None);
        await _context.SaveChangesAsync();

        // Assert
        var savedOrder = await _context.Orders.FirstOrDefaultAsync();
        savedOrder.Should().NotBeNull();
        savedOrder!.Id.Should().BeGreaterThan(0);
        savedOrder.CustomerId.Should().Be(123);
    }

    [Fact]
    public async Task GetByIdAsync_WhenExists_ShouldReturnOrder()
    {
        // Arrange
        var order = Order.Create(123, new List<OrderItem>
        {
            new(1, 1, 50m)
        });
        await _repository.AddAsync(order, CancellationToken.None);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetByIdAsync(order.Id, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(order.Id);
        result.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetByIdAsync_WhenNotExists_ShouldReturnNull()
    {
        // Act
        var result = await _repository.GetByIdAsync(999, CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByCustomerIdAsync_ShouldReturnAllCustomerOrders()
    {
        // Arrange
        var customerId = 123;
        await _repository.AddAsync(Order.Create(customerId, new List<OrderItem> { new(1, 1, 100m) }), CancellationToken.None);
        await _repository.AddAsync(Order.Create(customerId, new List<OrderItem> { new(2, 1, 200m) }), CancellationToken.None);
        await _repository.AddAsync(Order.Create(456, new List<OrderItem> { new(3, 1, 300m) }), CancellationToken.None);
        await _context.SaveChangesAsync();

        // Act
        var orders = await _repository.GetByCustomerIdAsync(customerId, CancellationToken.None);

        // Assert
        orders.Should().HaveCount(2);
        orders.Should().OnlyContain(o => o.CustomerId == customerId);
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
```

## Вывод после генерации

```
Tests Generated: OrdersControllerTests.cs
Location: tests/Api.Tests/OrdersControllerTests.cs

Test Methods: 5
├─ CreateOrder_WithValidData_ShouldReturn201
├─ CreateOrder_WithInvalidData_ShouldReturn400
├─ GetOrder_WhenExists_ShouldReturn200
├─ GetOrder_WhenNotExists_ShouldReturn404
└─ CancelOrder_WhenPending_ShouldReturn200

Coverage:
- Positive scenarios: 3
- Negative scenarios: 2
- Edge cases: 1

Dependencies Added:
- xunit (2.6.0)
- FluentAssertions (6.12.0)
- Microsoft.AspNetCore.Mvc.Testing (8.0.0)

Next Steps:
1. Review generated tests
2. Run tests: dotnet test
3. Adjust test data if needed
4. Add to CI/CD pipeline
```

## Best Practices

```csharp
// ✅ DO: Arrange-Act-Assert pattern
[Fact]
public async Task Method_Scenario_ExpectedBehavior()
{
    // Arrange
    var input = ...;

    // Act
    var result = await sut.MethodAsync(input);

    // Assert
    result.Should().Be(expected);
}

// ✅ DO: Descriptive test names
CreateOrder_WithValidData_ShouldReturn201()
GetOrder_WhenNotExists_ShouldReturn404()

// ❌ DON'T: Generic names
Test1()
TestCreateOrder()

// ✅ DO: One assertion per concept
[Fact]
public async Task CreateOrder_ShouldSetCorrectProperties()
{
    var order = await CreateOrderAsync();

    order.Status.Should().Be(OrderStatus.Pending);
    order.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
}

// ❌ DON'T: Multiple unrelated assertions
Assert.True(x);
Assert.Equal(y, z);
Assert.NotNull(a);
```

## Integration с CI/CD

```yaml
# .gitlab-ci.yml
test:
  stage: test
  script:
    - dotnet restore
    - dotnet build --no-restore
    - dotnet test --no-build --logger "trx;LogFileName=test-results.xml" --collect:"XPlat Code Coverage"
  artifacts:
    reports:
      junit: test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/coverage.cobertura.xml
  coverage: '/Total\s+\|\s+(\d+\.?\d*)%/'
```
