---
name: api-testing
description: API тестирование для REST APIs на .NET, contract testing, integration tests. Активируется при api testing, rest api, integration tests, contract testing, openapi, swagger
allowed-tools: Read, Grep, Glob, Bash
---

# API Testing

Skill для тестирования REST API на .NET с использованием xUnit, HttpClient, и WebApplicationFactory.

## 1. Типы API тестов

### Contract Tests

Проверка соответствия API контракту (OpenAPI/Swagger).

```csharp
// Contract test с использованием OpenAPI schema
public class ApiContractTests
{
    [Fact]
    public async Task GetOrder_Response_ShouldMatchOpenApiSchema()
    {
        // Arrange
        var schemaPath = "docs/openapi.json";
        var schema = await File.ReadAllTextAsync(schemaPath);

        // Act
        var response = await _client.GetAsync("/api/orders/123");
        var json = await response.Content.ReadAsStringAsync();

        // Assert
        var validator = new OpenApiValidator(schema);
        validator.Validate(json, "/orders/{id}").Should().BeTrue();
    }
}
```

### Integration Tests

Тестирование API с реальной БД (или test containers).

```csharp
// Integration test с WebApplicationFactory
public class OrdersApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly AppDbContext _dbContext;

    public OrdersApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace DB with in-memory for tests
                    services.RemoveAll<AppDbContext>();
                    services.AddDbContext<AppDbContext>(options =>
                        options.UseInMemoryDatabase("TestDb"));
                });
            })
            .CreateClient();

        var scope = factory.Services.CreateScope();
        _dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    }

    [Fact]
    public async Task CreateOrder_WithValidData_ShouldReturn201()
    {
        // Arrange
        var request = new CreateOrderRequest(
            CustomerId: 123,
            Items: new[] { new OrderItemDto(ProductId: 1, Quantity: 2) }
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var location = response.Headers.Location;
        location.Should().NotBeNull();

        var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
        order!.Id.Should().BeGreaterThan(0);
        order.Status.Should().Be("Pending");
    }
}
```

### End-to-End API Tests

Тестирование полного flow через API.

```csharp
public class CheckoutE2ETests
{
    [Fact]
    public async Task CompleteCheckout_FullFlow_ShouldCreateOrder()
    {
        // 1. Register user
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            Email = "test@example.com",
            Password = "Test123!"
        });
        registerResponse.EnsureSuccessStatusCode();

        // 2. Login
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = "test@example.com",
            Password = "Test123!"
        });
        var token = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();

        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token!.AccessToken);

        // 3. Add to cart
        var cartResponse = await _client.PostAsJsonAsync("/api/cart/items", new
        {
            ProductId = 1,
            Quantity = 2
        });
        cartResponse.EnsureSuccessStatusCode();

        // 4. Create order
        var orderResponse = await _client.PostAsJsonAsync("/api/orders", new
        {
            DeliveryAddress = "Москва, ул. Ленина, 1",
            DeliveryMethod = "courier"
        });
        orderResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // 5. Verify order
        var order = await orderResponse.Content.ReadFromJsonAsync<OrderResponse>();
        order!.Status.Should().Be("Pending");
        order.Items.Should().HaveCount(1);
    }
}
```

## 2. HTTP Methods Testing

### GET - Retrieve Resources

```csharp
[Fact]
public async Task GetOrders_WithPagination_ShouldReturnPagedResult()
{
    // Arrange
    await SeedOrdersAsync(25); // Create 25 orders

    // Act
    var response = await _client.GetAsync("/api/orders?page=2&pageSize=10");

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var result = await response.Content.ReadFromJsonAsync<PagedResult<OrderDto>>();
    result!.Items.Should().HaveCount(10);
    result.Page.Should().Be(2);
    result.TotalCount.Should().Be(25);
    result.TotalPages.Should().Be(3);
}

[Fact]
public async Task GetOrder_WhenNotExists_ShouldReturn404()
{
    // Act
    var response = await _client.GetAsync("/api/orders/999999");

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.NotFound);

    var problemDetails = await response.Content.ReadFromJsonAsync<ProblemDetails>();
    problemDetails!.Status.Should().Be(404);
    problemDetails.Title.Should().Be("Order not found");
}
```

### POST - Create Resources

```csharp
[Fact]
public async Task CreateOrder_WithValidData_ShouldReturn201WithLocation()
{
    // Arrange
    var request = new CreateOrderRequest(CustomerId: 123, Items: new[]
    {
        new OrderItemDto(ProductId: 1, Quantity: 2)
    });

    // Act
    var response = await _client.PostAsJsonAsync("/api/orders", request);

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.Created);
    response.Headers.Location.Should().NotBeNull();
    response.Headers.Location!.ToString().Should().Match(@"/api/orders/\d+");

    var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
    order!.Id.Should().BeGreaterThan(0);
}

[Theory]
[MemberData(nameof(InvalidOrderRequests))]
public async Task CreateOrder_WithInvalidData_ShouldReturn400(
    CreateOrderRequest request,
    string expectedError)
{
    // Act
    var response = await _client.PostAsJsonAsync("/api/orders", request);

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

    var problemDetails = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
    problemDetails!.Errors.Should().ContainKey(expectedError);
}

public static IEnumerable<object[]> InvalidOrderRequests()
{
    yield return new object[]
    {
        new CreateOrderRequest(0, Array.Empty<OrderItemDto>()),
        "CustomerId"
    };
    yield return new object[]
    {
        new CreateOrderRequest(123, Array.Empty<OrderItemDto>()),
        "Items"
    };
}
```

### PUT - Full Update

```csharp
[Fact]
public async Task UpdateOrder_WithValidData_ShouldReturn200()
{
    // Arrange
    var orderId = await CreateTestOrderAsync();
    var updateRequest = new UpdateOrderRequest(
        DeliveryAddress: "New Address",
        DeliveryMethod: "pickup"
    );

    // Act
    var response = await _client.PutAsJsonAsync($"/api/orders/{orderId}", updateRequest);

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var updated = await response.Content.ReadFromJsonAsync<OrderResponse>();
    updated!.DeliveryAddress.Should().Be("New Address");
    updated.DeliveryMethod.Should().Be("pickup");
}

[Fact]
public async Task UpdateOrder_WhenNotExists_ShouldReturn404()
{
    // Arrange
    var updateRequest = new UpdateOrderRequest("Address", "courier");

    // Act
    var response = await _client.PutAsJsonAsync("/api/orders/999999", updateRequest);

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.NotFound);
}
```

### PATCH - Partial Update

```csharp
[Fact]
public async Task PatchOrder_UpdateStatus_ShouldReturn200()
{
    // Arrange
    var orderId = await CreateTestOrderAsync();
    var patchDoc = new JsonPatchDocument<Order>();
    patchDoc.Replace(o => o.Status, OrderStatus.Processing);

    // Act
    var response = await _client.PatchAsync($"/api/orders/{orderId}",
        JsonContent.Create(patchDoc));

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var updated = await GetOrderAsync(orderId);
    updated.Status.Should().Be("Processing");
}
```

### DELETE - Remove Resources

```csharp
[Fact]
public async Task DeleteOrder_WhenExists_ShouldReturn204()
{
    // Arrange
    var orderId = await CreateTestOrderAsync();

    // Act
    var response = await _client.DeleteAsync($"/api/orders/{orderId}");

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.NoContent);

    // Verify deletion
    var getResponse = await _client.GetAsync($"/api/orders/{orderId}");
    getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
}

[Fact]
public async Task DeleteOrder_WhenNotExists_ShouldReturn404()
{
    // Act
    var response = await _client.DeleteAsync("/api/orders/999999");

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.NotFound);
}
```

## 3. Status Codes Testing

```csharp
public class StatusCodesTests
{
    [Theory]
    [InlineData("/api/orders", HttpStatusCode.OK)]              // 200
    [InlineData("/api/orders/123", HttpStatusCode.OK)]          // 200
    [InlineData("/api/orders/999999", HttpStatusCode.NotFound)] // 404
    public async Task Api_ShouldReturnCorrectStatusCodes(string url, HttpStatusCode expected)
    {
        var response = await _client.GetAsync(url);
        response.StatusCode.Should().Be(expected);
    }

    [Fact]
    public async Task CreateOrder_Success_ShouldReturn201Created()
    {
        var response = await CreateOrderAsync();
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateOrder_Validation_ShouldReturn400BadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/orders", new { });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetOrder_Unauthorized_ShouldReturn401()
    {
        _client.DefaultRequestHeaders.Authorization = null;
        var response = await _client.GetAsync("/api/orders/123");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAdminData_Forbidden_ShouldReturn403()
    {
        await LoginAsRegularUserAsync();
        var response = await _client.GetAsync("/api/admin/settings");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateOrder_Conflict_ShouldReturn409()
    {
        // Simulate optimistic concurrency conflict
        var order = await GetOrderAsync(123);
        order.RowVersion = "old-version";

        var response = await _client.PutAsJsonAsync($"/api/orders/{order.Id}", order);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
```

## 4. Authentication & Authorization

```csharp
public class AuthTests
{
    [Fact]
    public async Task AccessProtectedEndpoint_WithoutToken_ShouldReturn401()
    {
        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AccessProtectedEndpoint_WithValidToken_ShouldReturn200()
    {
        // Arrange
        var token = await GetAuthTokenAsync("user@example.com", "password");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AccessAdminEndpoint_AsRegularUser_ShouldReturn403()
    {
        // Arrange
        var token = await GetAuthTokenAsync("user@example.com", "password");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.GetAsync("/api/admin/users");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AccessAdminEndpoint_AsAdmin_ShouldReturn200()
    {
        // Arrange
        var token = await GetAuthTokenAsync("admin@example.com", "password");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.GetAsync("/api/admin/users");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

## 5. Data Validation

```csharp
public class ValidationTests
{
    [Theory]
    [InlineData("", "Email is required")]
    [InlineData("invalid-email", "Invalid email format")]
    [InlineData("a@b.c", "Email must be at least 5 characters")]
    public async Task Register_WithInvalidEmail_ShouldReturnValidationError(
        string email,
        string expectedError)
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            Email = email,
            Password = "ValidPass123!"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problemDetails = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        problemDetails!.Errors["Email"].Should().Contain(expectedError);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateOrder_WithEmptyAddress_ShouldReturnValidationError(string address)
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", new
        {
            CustomerId = 123,
            DeliveryAddress = address
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateOrder_WithNegativeQuantity_ShouldReturnValidationError()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", new
        {
            CustomerId = 123,
            Items = new[] { new { ProductId = 1, Quantity = -5 } }
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problemDetails = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        problemDetails!.Errors["Items[0].Quantity"]
            .Should().Contain("Quantity must be positive");
    }
}
```

## 6. Content Negotiation

```csharp
public class ContentNegotiationTests
{
    [Fact]
    public async Task GetOrders_AcceptJson_ShouldReturnJson()
    {
        // Arrange
        _client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));

        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        response.Content.Headers.ContentType!.MediaType
            .Should().Be("application/json");
    }

    [Fact]
    public async Task GetOrders_AcceptXml_ShouldReturnXml()
    {
        // Arrange
        _client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/xml"));

        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        response.Content.Headers.ContentType!.MediaType
            .Should().Be("application/xml");
    }

    [Fact]
    public async Task CreateOrder_WithJsonContent_ShouldAccept()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", new
        {
            CustomerId = 123
        });

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
    }
}
```

## 7. Performance Testing

```csharp
public class PerformanceTests
{
    [Fact]
    public async Task GetOrders_ShouldRespondWithin500ms()
    {
        // Arrange
        var stopwatch = Stopwatch.StartNew();

        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        stopwatch.Stop();
        stopwatch.ElapsedMilliseconds.Should().BeLessThan(500);
        response.IsSuccessStatusCode.Should().BeTrue();
    }

    [Fact]
    public async Task GetOrders_ConcurrentRequests_ShouldHandleLoad()
    {
        // Arrange
        const int concurrentRequests = 100;

        // Act
        var tasks = Enumerable.Range(0, concurrentRequests)
            .Select(_ => _client.GetAsync("/api/orders"))
            .ToArray();

        var responses = await Task.WhenAll(tasks);

        // Assert
        responses.Should().OnlyContain(r => r.IsSuccessStatusCode);
    }
}
```

## 8. Error Handling

```csharp
public class ErrorHandlingTests
{
    [Fact]
    public async Task Api_WhenException_ShouldReturnProblemDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/orders/invalid-id");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problemDetails = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problemDetails.Should().NotBeNull();
        problemDetails!.Type.Should().NotBeNullOrEmpty();
        problemDetails.Title.Should().NotBeNullOrEmpty();
        problemDetails.Status.Should().Be(400);
    }

    [Fact]
    public async Task Api_WhenServerError_ShouldReturn500WithDetails()
    {
        // Arrange - simulate server error
        await SimulateServerErrorAsync();

        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        var problemDetails = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problemDetails!.Status.Should().Be(500);
        problemDetails.Detail.Should().NotBeNullOrEmpty();
    }
}
```

## 9. Best Practices

```csharp
// ✅ DO: Use WebApplicationFactory for integration tests
public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }
}

// ✅ DO: Test happy path AND edge cases
[Theory]
[InlineData(1, true)]      // Valid
[InlineData(0, false)]     // Boundary
[InlineData(-1, false)]    // Invalid
[InlineData(1000, true)]   // Large valid
public async Task TestVariousInputs(int value, bool shouldSucceed)

// ✅ DO: Clean up test data
public async Task DisposeAsync()
{
    await _dbContext.Database.EnsureDeletedAsync();
}

// ❌ DON'T: Test implementation details
// Test behavior, not internals

// ❌ DON'T: Use real external services
// Use mocks or test containers

// ❌ DON'T: Share state between tests
// Each test should be independent
```

## 10. Test Organization

```
tests/
└── Api.Tests/
    ├── Controllers/
    │   ├── OrdersControllerTests.cs
    │   ├── UsersControllerTests.cs
    │   └── ProductsControllerTests.cs
    ├── Integration/
    │   ├── CheckoutFlowTests.cs
    │   └── OrderProcessingTests.cs
    ├── Helpers/
    │   ├── TestDataBuilder.cs
    │   └── ApiTestFixture.cs
    └── _Imports.cs
```

## Checklist

```
API Testing Checklist:

☐ Happy path scenarios
☐ Error scenarios (4xx, 5xx)
☐ Input validation
☐ Authentication/Authorization
☐ Pagination
☐ Filtering/Sorting
☐ Status codes correctness
☐ Response schema validation
☐ Content negotiation
☐ Idempotency (PUT, DELETE)
☐ Concurrent requests handling
☐ Performance (response time)
```
