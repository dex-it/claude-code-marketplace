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

## Correlation ID

Обязательно для микросервисов — связывает логи одного запроса через все сервисы.

```csharp
public class CorrelationIdMiddleware
{
    private const string Header = "X-Correlation-ID";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[Header].FirstOrDefault()
            ?? Activity.Current?.TraceId.ToString()
            ?? Guid.NewGuid().ToString();

        context.Response.Headers[Header] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}
```

Пробрасывай при вызовах между сервисами:

```csharp
public class CorrelationIdHandler : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        var correlationId = _httpContextAccessor.HttpContext?
            .Response.Headers["X-Correlation-ID"].FirstOrDefault();

        if (!string.IsNullOrEmpty(correlationId))
            request.Headers.Add("X-Correlation-ID", correlationId);

        return base.SendAsync(request, ct);
    }
}
```

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
