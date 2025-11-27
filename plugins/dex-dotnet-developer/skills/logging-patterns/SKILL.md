---
name: logging-patterns
description: Structured logging в .NET с Serilog и Seq - конфигурация, enrichers, sinks. Активируется при serilog, seq, logging, structured logging, log, trace, telemetry, enricher
allowed-tools: Read, Grep, Glob
---

# Logging Patterns в .NET

## Serilog Configuration

### Базовая настройка

```csharp
// Program.cs
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithEnvironmentName()
    .Enrich.WithProperty("Application", "MyApp")
    .WriteTo.Console(new JsonFormatter())
    .WriteTo.Seq("http://localhost:5341")
    .CreateLogger();

try
{
    Log.Information("Starting application");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // ... configuration

    var app = builder.Build();
    app.UseSerilogRequestLogging();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
```

### Конфигурация из appsettings.json

```json
{
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.Seq"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.Hosting.Lifetime": "Information",
        "Microsoft.EntityFrameworkCore": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "formatter": "Serilog.Formatting.Json.JsonFormatter, Serilog"
        }
      },
      {
        "Name": "Seq",
        "Args": {
          "serverUrl": "http://localhost:5341",
          "apiKey": "${SEQ_API_KEY}"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithEnvironmentName"],
    "Properties": {
      "Application": "MyApp"
    }
  }
}
```

```csharp
// Program.cs
builder.Host.UseSerilog((context, config) =>
{
    config.ReadFrom.Configuration(context.Configuration);
});
```

## Structured Logging

### Правильное использование

```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    // Хорошо - structured logging
    public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
    {
        _logger.LogInformation("Creating order for customer {CustomerId} with {ItemCount} items",
            request.CustomerId, request.Items.Count);

        try
        {
            var order = await ProcessOrderAsync(request);

            _logger.LogInformation("Order {OrderId} created successfully. Total: {OrderTotal:C}",
                order.Id, order.Total);

            return order;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create order for customer {CustomerId}",
                request.CustomerId);
            throw;
        }
    }
}

// Плохо - string interpolation
_logger.LogInformation($"Creating order for customer {request.CustomerId}"); // НЕ делать так!
```

### Semantic Types

```csharp
// Использование @ для сериализации объектов
_logger.LogInformation("Order created: {@Order}", order);

// Использование $ для ToString()
_logger.LogInformation("Order created: {$Order}", order);
```

## Enrichers

### Custom Enricher

```csharp
public class UserIdEnricher : ILogEventEnricher
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var userId = _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!string.IsNullOrEmpty(userId))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty("UserId", userId));
        }
    }
}

// Регистрация
Log.Logger = new LoggerConfiguration()
    .Enrich.With<UserIdEnricher>()
    .CreateLogger();
```

### Request Logging Enricher

```csharp
app.UseSerilogRequestLogging(options =>
{
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("UserAgent", httpContext.Request.Headers["User-Agent"].ToString());
        diagnosticContext.Set("ClientIP", httpContext.Connection.RemoteIpAddress?.ToString());

        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            diagnosticContext.Set("UserId", httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier));
        }
    };

    options.MessageTemplate = "{RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
});
```

## Correlation ID

### Middleware

```csharp
public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string CorrelationIdHeader = "X-Correlation-ID";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
            ?? Guid.NewGuid().ToString();

        context.Response.Headers[CorrelationIdHeader] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}
```

### HttpClient Propagation

```csharp
public class CorrelationIdHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        var correlationId = _httpContextAccessor.HttpContext?
            .Response.Headers["X-Correlation-ID"].FirstOrDefault();

        if (!string.IsNullOrEmpty(correlationId))
        {
            request.Headers.Add("X-Correlation-ID", correlationId);
        }

        return base.SendAsync(request, ct);
    }
}
```

## Seq Integration

### Настройка Seq

```csharp
.WriteTo.Seq(
    serverUrl: "http://localhost:5341",
    apiKey: configuration["Seq:ApiKey"],
    batchPostingLimit: 50,
    period: TimeSpan.FromSeconds(2),
    queueSizeLimit: 10000)
```

### Docker Compose с Seq

```yaml
seq:
  image: datalust/seq:latest
  environment:
    ACCEPT_EULA: "Y"
    SEQ_FIRSTRUN_ADMINPASSWORDHASH: "${SEQ_ADMIN_PASSWORD_HASH}"
  ports:
    - "5341:80"
    - "5342:5342"  # Ingestion port
  volumes:
    - seq_data:/data
```

## Performance Logging

### Timed Operations

```csharp
public class PerformanceLogger
{
    private readonly ILogger _logger;

    public IDisposable TimeOperation(string operationName, params object[] args)
    {
        return new TimedOperation(_logger, operationName, args);
    }

    private class TimedOperation : IDisposable
    {
        private readonly ILogger _logger;
        private readonly string _operationName;
        private readonly object[] _args;
        private readonly Stopwatch _stopwatch;

        public TimedOperation(ILogger logger, string operationName, object[] args)
        {
            _logger = logger;
            _operationName = operationName;
            _args = args;
            _stopwatch = Stopwatch.StartNew();

            _logger.LogDebug("Starting " + _operationName, _args);
        }

        public void Dispose()
        {
            _stopwatch.Stop();
            var allArgs = _args.Concat(new object[] { _stopwatch.ElapsedMilliseconds }).ToArray();
            _logger.LogInformation(_operationName + " completed in {ElapsedMs}ms", allArgs);
        }
    }
}

// Использование
using (_performanceLogger.TimeOperation("Processing order {OrderId}", orderId))
{
    await ProcessOrderAsync(orderId);
}
```

### Source Generator (High-Performance)

```csharp
public static partial class LoggerExtensions
{
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Order {OrderId} created for customer {CustomerId}")]
    public static partial void OrderCreated(
        this ILogger logger, Guid orderId, Guid customerId);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Error,
        Message = "Failed to process order {OrderId}")]
    public static partial void OrderProcessingFailed(
        this ILogger logger, Guid orderId, Exception ex);
}

// Использование
_logger.OrderCreated(order.Id, order.CustomerId);
_logger.OrderProcessingFailed(orderId, ex);
```

## Log Levels Best Practices

```csharp
// Trace - детальная диагностика (обычно отключено)
_logger.LogTrace("Entering method {MethodName} with params {@Params}", methodName, parameters);

// Debug - информация для разработчиков
_logger.LogDebug("Cache miss for key {CacheKey}", cacheKey);

// Information - важные бизнес-события
_logger.LogInformation("Order {OrderId} shipped to {Address}", orderId, address);

// Warning - потенциальные проблемы
_logger.LogWarning("Payment retry {RetryCount} for order {OrderId}", retryCount, orderId);

// Error - ошибки, но приложение продолжает работать
_logger.LogError(ex, "Failed to send email to {Email}", email);

// Critical - критические ошибки, требующие немедленного внимания
_logger.LogCritical(ex, "Database connection lost");
```

## Filtering Sensitive Data

```csharp
public class SensitiveDataEnricher : ILogEventEnricher
{
    private static readonly string[] SensitiveFields =
        { "password", "creditcard", "ssn", "token" };

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var properties = logEvent.Properties.ToList();

        foreach (var prop in properties)
        {
            if (SensitiveFields.Any(f =>
                prop.Key.Contains(f, StringComparison.OrdinalIgnoreCase)))
            {
                logEvent.AddOrUpdateProperty(
                    propertyFactory.CreateProperty(prop.Key, "***REDACTED***"));
            }
        }
    }
}
```
