---
name: async-patterns
description: Async/await паттерны, блокировки, параллелизм. Активируется при async, await, task, cancellation, parallel, deadlock, semaphore, lock, channel
allowed-tools: Read, Grep, Glob
---

# Async Patterns

## Правила

- async/await до конца цепочки, никогда .Result / .Wait()
- CancellationToken в каждом async методе, пробрасывай до БД/HTTP
- async void — только для event handlers
- Fire-and-forget — только с обработкой ошибок
- lock + await = deadlock, используй SemaphoreSlim
- ConfigureAwait(false) — только в библиотеках, не в ASP.NET Core

## Анти-паттерны

```csharp
// Плохо — .Result блокирует поток, риск deadlock
var result = GetDataAsync().Result;
var result2 = GetDataAsync().GetAwaiter().GetResult();

// Хорошо
var result = await GetDataAsync(ct);

// Плохо — async void (исключения теряются, нельзя await)
public async void ProcessAsync() { }

// Хорошо
public async Task ProcessAsync(CancellationToken ct) { }

// Плохо — fire and forget без обработки ошибок
_ = SendEmailAsync();

// Хорошо — fire and forget с логированием
_ = Task.Run(async () =>
{
    try { await SendEmailAsync(); }
    catch (Exception ex) { _logger.LogError(ex, "Email send failed"); }
});

// Плохо — Task.Run для оборачивания sync в async
public Task<Order> GetOrderAsync(int id)
{
    return Task.Run(() => _repository.GetOrder(id)); // пустая трата потока
}

// Хорошо — используй реально асинхронный метод
public Task<Order?> GetOrderAsync(int id, CancellationToken ct)
{
    return _context.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);
}

// Плохо — ненужный async/await (overhead state machine)
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)
{
    return await _repository.GetByIdAsync(id, ct); // просто проброс
}

// Хорошо — прямой return Task (но теряешь stack trace при ошибке)
public Task<Order> GetOrderAsync(int id, CancellationToken ct)
{
    return _repository.GetByIdAsync(id, ct);
}
// Оставь async/await если есть try/catch или using
```

## CancellationToken

```csharp
// Controller → Service → Repository — пробрасывай везде
[HttpGet("{id}")]
public async Task<ActionResult<OrderDto>> GetOrder(int id, CancellationToken ct)
{
    var order = await _service.GetOrderAsync(id, ct);
    return Ok(order);
}

// Проверка в долгих операциях
public async Task ProcessItemsAsync(IEnumerable<Item> items, CancellationToken ct)
{
    foreach (var item in items)
    {
        ct.ThrowIfCancellationRequested();
        await ProcessItemAsync(item, ct);
    }
}

// Timeout через linked token
using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
cts.CancelAfter(TimeSpan.FromSeconds(30));
await ExternalApiCallAsync(cts.Token);
```

## Параллельное выполнение

```csharp
// Независимые задачи — Task.WhenAll
var orderTask = _orderService.GetAsync(orderId, ct);
var customerTask = _customerService.GetAsync(customerId, ct);

await Task.WhenAll(orderTask, customerTask);

var order = await orderTask;     // уже завершён, без ожидания
var customer = await customerTask;

// Обработка массива с ограничением параллелизма (EF 7+)
await Parallel.ForEachAsync(
    items,
    new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct },
    async (item, token) =>
    {
        await ProcessItemAsync(item, token);
    });
```

## Блокировки и async

```csharp
// DEADLOCK! lock + await несовместимы
private readonly object _lock = new();
lock (_lock)
{
    await DoSomethingAsync(); // deadlock — lock не отпускает поток
}

// Хорошо — SemaphoreSlim как async lock
private readonly SemaphoreSlim _semaphore = new(1, 1);

await _semaphore.WaitAsync(ct);
try
{
    await DoSomethingAsync(ct);
}
finally
{
    _semaphore.Release();
}

// Ограничение параллелизма (throttling)
private readonly SemaphoreSlim _throttle = new(10); // макс 10 одновременно

var tasks = urls.Select(async url =>
{
    await _throttle.WaitAsync(ct);
    try { return await _httpClient.GetAsync(url, ct); }
    finally { _throttle.Release(); }
});

await Task.WhenAll(tasks);
```

## Асинхронный контекст

HttpContext, DbContext, scoped-сервисы — привязаны к запросу. В фоновых задачах их нет.

```csharp
// ОШИБКА — HttpContext не существует в фоновом потоке
_ = Task.Run(async () =>
{
    var userId = _httpContextAccessor.HttpContext?.User; // null!
    await _service.DoWork(userId);
});

// Хорошо — захвати данные ДО перехода в фон
var userId = _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
_ = Task.Run(async () =>
{
    await _service.DoWork(userId); // значение уже извлечено
});

// ОШИБКА — DbContext (Scoped) используется после завершения запроса
_ = Task.Run(async () =>
{
    await _context.SaveChangesAsync(); // ObjectDisposedException!
});

// Хорошо — создай новый scope
_ = Task.Run(async () =>
{
    using var scope = _serviceProvider.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.SaveChangesAsync();
});

// Хорошо — используй IServiceScopeFactory в BackgroundService
public class OrderProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
        await repo.ProcessPendingAsync(ct);
    }
}
```

### Правила

- HttpContext/User — извлеки нужные значения до async boundary
- DbContext — не передавай в фоновые задачи, создай новый scope
- Scoped сервисы в BackgroundService — через IServiceScopeFactory
- AsyncLocal<T> — для передачи контекста через await (correlation id, tenant id):

```csharp
private static readonly AsyncLocal<string?> _tenantId = new();

// Установить в middleware
_tenantId.Value = httpContext.Request.Headers["X-Tenant-ID"];

// Доступно в любом await дальше по цепочке, включая другие сервисы
var tenant = _tenantId.Value;
```

## Channel — producer/consumer

```csharp
// Буферизованная очередь задач внутри процесса
var channel = Channel.CreateBounded<WorkItem>(100);

// Producer
async Task ProduceAsync(ChannelWriter<WorkItem> writer, CancellationToken ct)
{
    await foreach (var item in GetItemsAsync(ct))
    {
        await writer.WriteAsync(item, ct);
    }
    writer.Complete();
}

// Consumer
async Task ConsumeAsync(ChannelReader<WorkItem> reader, CancellationToken ct)
{
    await foreach (var item in reader.ReadAllAsync(ct))
    {
        await ProcessAsync(item, ct);
    }
}

// Запуск
await Task.WhenAll(
    ProduceAsync(channel.Writer, ct),
    ConsumeAsync(channel.Reader, ct));
```

## IAsyncEnumerable — стриминг данных

```csharp
// Не загружает всё в память — стримит по одному
public async IAsyncEnumerable<Order> GetOrdersStreamAsync(
    [EnumeratorCancellation] CancellationToken ct)
{
    await foreach (var order in _context.Orders.AsAsyncEnumerable().WithCancellation(ct))
    {
        yield return order;
    }
}

// Использование в Controller — streaming response
[HttpGet("stream")]
public IAsyncEnumerable<OrderDto> GetOrdersStream(CancellationToken ct)
{
    return _service.GetOrdersStreamAsync(ct)
        .Select(o => MapToDto(o));
}
```

## Чек-лист

- [ ] Нет .Result / .Wait() / .GetAwaiter().GetResult()
- [ ] Нет async void (кроме event handlers)
- [ ] CancellationToken пробрасывается до конца
- [ ] Независимые задачи запускаются через Task.WhenAll
- [ ] lock заменён на SemaphoreSlim в async коде
- [ ] Fire-and-forget с обработкой ошибок
- [ ] Параллелизм ограничен (SemaphoreSlim / MaxDegreeOfParallelism)
