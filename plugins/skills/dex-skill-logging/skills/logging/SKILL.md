---
name: logging-patterns
description: Structured logging в .NET с Serilog. Активируется при serilog, seq, logging, structured logging, log, enricher, correlation id
allowed-tools: Read, Grep, Glob
---

# Logging Patterns

## Правила

- Используй `ILogger<T>` через DI, не статический `Serilog.Log` в прикладном коде
- Structured logging, никогда string interpolation и конкатенация
- Имена свойств в шаблонах — PascalCase: `{OrderId}`, `{FileName}`, `{ElapsedMs}`
- Log levels: бизнес-события = Information, потенциальные проблемы = Warning, сбои = Error
- Не логируй sensitive data (пароли, токены, PII — email, телефон)
- Не дампи большие объекты — логируй id, размеры, длительности
- Correlation ID в каждом запросе — для трассировки между сервисами
- High-perf пути — используй Source Generators (LoggerMessage)

## Анти-паттерны

```csharp
// Плохо — string interpolation (аллокация строки даже если уровень отключён)
_logger.LogInformation($"Order {orderId} created for {customerId}");

// Хорошо — structured logging (параметры подставляются только если уровень активен)
_logger.LogInformation("Order {OrderId} created for {CustomerId}", orderId, customerId);

// Плохо — статический Log
Serilog.Log.Information("Something happened");

// Хорошо — ILogger<T> через DI
_logger.LogInformation("Something happened");

// Плохо — логируем sensitive data
_logger.LogInformation("User {Email} logged in with password {Password}", email, password);

// Хорошо — только безопасные поля
_logger.LogInformation("User {UserId} logged in from {IP}", userId, ip);

// Плохо — дамп большого объекта
_logger.LogInformation("Request: {@Request}", httpRequest);

// Хорошо — ключевые id и метрики
_logger.LogInformation("Import {FileName} ({SizeKb}kb) completed in {ElapsedMs:000}ms", name, size, elapsed);

// Плохо — пустой catch
catch (Exception) { }

// Плохо — логируем но глотаем
catch (Exception ex) { _logger.LogError(ex, "Error"); }

// Хорошо — логируем и пробрасываем
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to process order {OrderId}", orderId);
    throw;
}

// Плохо — избыточное логирование (спам)
foreach (var item in items)
    _logger.LogInformation("Processing item {ItemId}", item.Id);

// Хорошо — агрегированное
_logger.LogInformation("Processing {Count} items for order {OrderId}", items.Count, orderId);
```

## Semantic Types: @ vs $

```csharp
// @ — сериализует объект в JSON (для анализа в Seq)
_logger.LogInformation("Order created: {@Order}", order);
// → Order: {"Id": 123, "Total": 99.5, "Items": [...]}

// $ — вызывает ToString() (для краткого представления)
_logger.LogInformation("Order created: {$Order}", order);
// → Order: "Order #123"

// Без префикса — как есть (для примитивов)
_logger.LogInformation("Order {OrderId} total: {Total:C}", id, total);
```

## Log Levels — как выбирать

### Дерево решений

```
Событие произошло
├─ Приложение падает/не может работать дальше?
│  └─ Да → Critical
├─ Операция завершилась ошибкой?
│  ├─ Нужна реакция дежурного? → Error
│  └─ Само восстановится (retry, fallback)? → Warning
├─ Это штатное бизнес-событие?
│  └─ Да → Information
├─ Полезно для диагностики при разработке?
│  └─ Да → Debug
└─ Нужно только при глубокой отладке конкретной проблемы?
   └─ Да → Trace
```

### Уровни с примерами

| Level | Когда | Примеры | В production |
|-------|-------|---------|-------------|
| Trace | Пошаговая трассировка, вход/выход из методов | `Entering Validate({@Input})` | OFF |
| Debug | Диагностика: промежуточные состояния, cache, query | `Cache miss for {Key}`, `SQL: {Query}` | OFF (включаем при расследовании) |
| Information | Ключевые бизнес-события, жизненный цикл | `Order {OrderId} created`, `App started` | ON — основной уровень |
| Warning | Не ошибка, но подозрительно или деградация | `Retry {Attempt} for {Service}`, `Rate limit approaching` | ON |
| Error | Сбой операции, требует внимания, но app живо | `Failed to send email to {UserId}`, `Payment declined` | ON — алерт |
| Critical | Приложение не может продолжать работу | `DB connection lost`, `Out of memory` | ON — немедленный алерт |

### Типичные ошибки выбора уровня

```csharp
// Плохо — Warning для штатной ситуации (validation — это нормально)
_logger.LogWarning("Invalid input: {Field}", field);
// Хорошо — Debug (или Information если важно для бизнеса)
_logger.LogDebug("Validation failed for {Field}: {Reason}", field, reason);

// Плохо — Error для ожидаемой ситуации
_logger.LogError("User {UserId} not found");
// Хорошо — Warning (или Debug, если это частый сценарий)
_logger.LogWarning("User {UserId} not found", userId);

// Плохо — Information для отладочной информации (спам в prod)
_logger.LogInformation("Checking cache for key {Key}", key);
// Хорошо — Debug
_logger.LogDebug("Cache miss for key {Key}", key);

// Плохо — Error без exception object
_logger.LogError("Something failed for {OrderId}", orderId);
// Хорошо — Error с exception
_logger.LogError(ex, "Failed to process order {OrderId}", orderId);
```

## Source Generators (High-Performance)

Для hot paths — zero-allocation logging:

```csharp
public static partial class LogMessages
{
    [LoggerMessage(EventId = 1001, Level = LogLevel.Information,
        Message = "Order {OrderId} created for customer {CustomerId}")]
    public static partial void OrderCreated(this ILogger logger, Guid orderId, Guid customerId);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Error,
        Message = "Failed to process order {OrderId}")]
    public static partial void OrderFailed(this ILogger logger, Guid orderId, Exception ex);
}

// Вызов — типобезопасный, без boxing
_logger.OrderCreated(order.Id, order.CustomerId);
```

## Logger Scopes

BeginScope добавляет свойства ко ВСЕМ логам внутри блока — не нужно повторять JobId/UserId в каждом вызове.

```csharp
// Без scope — дублирование контекста в каждой строке
_logger.LogInformation("Job {JobName} with id={JobId} started", jobName, jobId);
_logger.LogInformation("Job {JobName} with id={JobId} processing step 1", jobName, jobId);
_logger.LogInformation("Job {JobName} with id={JobId} finished", jobName, jobId);

// Со scope — контекст автоматически в каждом логе
using (_logger.BeginScope(new Dictionary<string, object>
{
    ["JobId"] = jobId,
    ["JobName"] = jobName
}))
{
    _logger.LogInformation("Job started");
    await ExecuteInner(context);
    _logger.LogInformation("Job finished");
    // В Seq/Loki: каждая строка содержит JobId и JobName
}
```

### Когда использовать

| Сценарий | Scope |
|----------|-------|
| Background job / Quartz | `JobId`, `JobName` |
| HTTP запрос | `CorrelationId`, `UserId` (через middleware) |
| Обработка сообщения из очереди | `MessageId`, `QueueName` |
| Batch операция | `BatchId`, `ItemCount` |

### Вложенные scopes

```csharp
using (_logger.BeginScope(new Dictionary<string, object> { ["OrderId"] = orderId }))
{
    _logger.LogInformation("Processing order"); // OrderId в контексте

    using (_logger.BeginScope(new Dictionary<string, object> { ["Step"] = "payment" }))
    {
        _logger.LogInformation("Charging customer"); // OrderId + Step
    }
}
```

## Distributed Tracing & Correlation

### Как это работает

ASP.NET Core (.NET 6+) из коробки поддерживает W3C Trace Context:
- Входящие запросы: TraceId берётся из заголовка `traceparent` (W3C стандарт)
- `Activity.Current?.TraceId` — доступен везде в рамках запроса
- HttpClient: автоматически прокидывает `traceparent` в исходящие запросы

**Не нужно** писать свой middleware для HTTP-to-HTTP — всё работает из коробки.

### Когда нужен ручной проброс

Автоматика ломается на границах: очереди, outbox, фоновые задачи. Там нужно сохранить `Activity.Current?.Id` и восстановить через `SetParentId`.

### Проброс через очереди (MassTransit)

```csharp
// Send filter — прокидываем ActivityId в headers сообщения
private static void SetActivityHeader(SendContext context)
{
    if (Activity.Current?.Id != null)
        context.Headers.Set("ActivityId", Activity.Current.Id);
}

// Consume filter — восстанавливаем Activity из headers
public async Task Send(ConsumeContext context, IPipe<ConsumeContext> next)
{
    using var activity = new Activity($"Consuming: {context.DestinationAddress?.GetExchangeName()}");

    var parentId = context.Headers.Get<string>("ActivityId");
    if (parentId != null)
        activity.SetParentId(parentId); // связываем с родительским trace

    activity.Start();
    try { await next.Send(context); }
    finally { activity.Stop(); }
}
```

### Проброс через Outbox / фоновые задачи

Паттерн: сохраняем ActivityId в БД → восстанавливаем при обработке.

```csharp
// Entity — сохраняем ActivityId
public class OutboxMessage
{
    public Guid Id { get; set; }
    public string MessageType { get; set; }
    public string Content { get; set; }
    public string? ActivityId { get; set; } // <- ключевое поле
}

// При создании — захватываем текущий Activity
var message = new OutboxMessage
{
    Id = Guid.NewGuid(),
    MessageType = typeof(OrderCreated).Name,
    Content = JsonSerializer.Serialize(payload),
    ActivityId = Activity.Current?.Id  // сохраняем!
};
_context.OutboxMessages.Add(message);

// При обработке — восстанавливаем trace chain
using var activity = new Activity($"Process outbox: {message.Id}");
activity.AddBaggage("MessageType", message.MessageType);

if (!string.IsNullOrEmpty(message.ActivityId))
    activity.SetParentId(message.ActivityId); // связываем с исходным запросом

activity.Start();
try
{
    await ProcessAsync(message, ct);
}
finally
{
    activity.Stop();
}
```

### Поиск по TraceId

```sql
-- В таблице outbox / background tasks:
SELECT * FROM outbox_messages WHERE "ActivityId" LIKE '%94a510ac79a6216b%'

-- В Seq:
@TraceId = "94a510ac79a6216b3da6af7a8235a879"
```

### Итого — где проброс автоматический, где ручной

> Таблица ниже — ориентир для .NET 6+ / MassTransit / EF Core. В конкретном проекте проверяй, что и как прокидывается — библиотеки и фреймворки могут делать это за тебя.

| Сценарий | Проброс | Что делать |
|----------|---------|------------|
| HTTP → HTTP | Автоматический | Ничего (.NET 6+ W3C traceparent) |
| HTTP → очередь | Ручной | Send filter: `Activity.Current.Id` → header |
| Очередь → обработчик | Ручной | Consume filter: header → `SetParentId` |
| HTTP → outbox → фон | Ручной | Сохранить ActivityId в БД, восстановить при обработке |
| BackgroundService | Ручной | IServiceScopeFactory + новый Activity |

## Sensitive Data Filtering

```csharp
public class SensitiveDataEnricher : ILogEventEnricher
{
    private static readonly string[] SensitiveFields =
        { "password", "creditcard", "ssn", "token", "secret", "apikey" };

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory factory)
    {
        foreach (var prop in logEvent.Properties.ToList())
        {
            if (SensitiveFields.Any(f =>
                prop.Key.Contains(f, StringComparison.OrdinalIgnoreCase)))
            {
                logEvent.AddOrUpdateProperty(
                    factory.CreateProperty(prop.Key, "***REDACTED***"));
            }
        }
    }
}
```

## Чек-лист

- [ ] Structured logging (не string interpolation)
- [ ] Correlation ID middleware подключен
- [ ] Sensitive data и PII не попадают в логи
- [ ] Нет дампов больших объектов — только id, размеры, длительности
- [ ] Свойства в PascalCase: `{OrderId}`, не `{orderId}`
- [ ] Error логи содержат exception + контекст (OrderId, UserId)
- [ ] Нет спама — логируем события, не итерации
- [ ] Hot paths используют LoggerMessage source generators
- [ ] MinimumLevel.Override для Microsoft/EF — Warning
