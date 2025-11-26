---
name: async-patterns
description: Async/await паттерны, CancellationToken, параллельное выполнение. Активируется при async, await, task, cancellation, parallel
allowed-tools: Read, Grep, Glob
---

# Async Patterns в .NET

## Основы async/await

### Правильное использование

```csharp
// Правильно
public async Task<Order> GetOrderAsync(int id, CancellationToken ct = default)
{
    return await _repository.GetOrderAsync(id, ct);
}

// Неправильно - блокирует поток
public Order GetOrder(int id)
{
    return _repository.GetOrderAsync(id).Result; // Deadlock!
}

// Неправильно - не нужен Task.Run
public Task<Order> GetOrderAsync(int id)
{
    return Task.Run(() => _repository.GetOrder(id));
}
```

### ConfigureAwait

```csharp
// В ASP.NET Core НЕ нужен ConfigureAwait(false)
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)
{
    return await _repository.GetOrderAsync(id, ct);
    // НЕ: .ConfigureAwait(false) - не нужно в ASP.NET Core
}

// В библиотеках - можно использовать
public async Task<T> LibraryMethodAsync<T>()
{
    return await SomeOperationAsync().ConfigureAwait(false);
}
```

## CancellationToken

### Передача через всю цепочку

```csharp
// Controller
[HttpGet("{id}")]
public async Task<ActionResult<OrderDto>> GetOrder(int id, CancellationToken ct)
{
    var order = await _service.GetOrderAsync(id, ct);
    return Ok(order);
}

// Service
public async Task<OrderDto> GetOrderAsync(int id, CancellationToken ct)
{
    var order = await _repository.GetByIdAsync(id, ct);
    return MapToDto(order);
}

// Repository
public async Task<Order?> GetByIdAsync(int id, CancellationToken ct)
{
    return await _context.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);
}
```

### Проверка отмены

```csharp
public async Task ProcessItemsAsync(IEnumerable<Item> items, CancellationToken ct)
{
    foreach (var item in items)
    {
        ct.ThrowIfCancellationRequested(); // Проверка перед каждой итерацией
        await ProcessItemAsync(item, ct);
    }
}
```

### Timeout

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
try
{
    await LongOperationAsync(cts.Token);
}
catch (OperationCanceledException)
{
    // Timeout
}
```

## Параллельное выполнение

### Task.WhenAll

```csharp
// Параллельный запуск
var orderTask = _orderService.GetOrderAsync(orderId, ct);
var customerTask = _customerService.GetCustomerAsync(customerId, ct);
var productTask = _productService.GetProductsAsync(productIds, ct);

await Task.WhenAll(orderTask, customerTask, productTask);

var order = await orderTask;
var customer = await customerTask;
var products = await productTask;
```

### Parallel.ForEachAsync

```csharp
await Parallel.ForEachAsync(
    items,
    new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct },
    async (item, token) =>
    {
        await ProcessItemAsync(item, token);
    });
```

### SemaphoreSlim для ограничения

```csharp
var semaphore = new SemaphoreSlim(10); // максимум 10 параллельных

var tasks = items.Select(async item =>
{
    await semaphore.WaitAsync(ct);
    try
    {
        await ProcessItemAsync(item, ct);
    }
    finally
    {
        semaphore.Release();
    }
});

await Task.WhenAll(tasks);
```

## Антипаттерны

```csharp
// Не делай так - async void (кроме event handlers)
public async void ProcessAsync() { } // Исключения теряются!

// Не делай так - .Result или .Wait()
var result = GetDataAsync().Result; // Deadlock риск

// Не делай так - Fire and forget без обработки ошибок
_ = SendEmailAsync(); // Исключения потеряются

// Правильно - fire and forget с обработкой
_ = Task.Run(async () =>
{
    try { await SendEmailAsync(); }
    catch (Exception ex) { _logger.LogError(ex, "Email failed"); }
});
```
