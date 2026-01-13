---
name: observability-patterns
description: OpenTelemetry, distributed tracing, metrics, health checks в .NET. Активируется при opentelemetry, tracing, observability, prometheus, metrics, health check, telemetry
allowed-tools: Read, Grep, Glob
---

# Observability Patterns для .NET

## OpenTelemetry Setup

### Установка пакетов

```bash
dotnet add package OpenTelemetry.Extensions.Hosting
dotnet add package OpenTelemetry.Instrumentation.AspNetCore
dotnet add package OpenTelemetry.Instrumentation.Http
dotnet add package OpenTelemetry.Instrumentation.EntityFrameworkCore
dotnet add package OpenTelemetry.Exporter.Prometheus.AspNetCore
dotnet add package OpenTelemetry.Exporter.OpenTelemetryProtocol
```

### Конфигурация в Program.cs

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource
        .AddService(
            serviceName: builder.Configuration["ServiceName"] ?? "MyService",
            serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString() ?? "1.0.0"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation(options =>
        {
            options.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health");
            options.RecordException = true;
        })
        .AddHttpClientInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddSource("MyService")
        .AddOtlpExporter(options =>
        {
            options.Endpoint = new Uri(builder.Configuration["Otlp:Endpoint"] ?? "http://localhost:4317");
        }))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddProcessInstrumentation()
        .AddPrometheusExporter());

// Prometheus endpoint
app.MapPrometheusScrapingEndpoint();
```

## Distributed Tracing

### Создание кастомных Spans

```csharp
public class OrderService
{
    private static readonly ActivitySource ActivitySource = new("MyService.Orders");
    private readonly ILogger<OrderService> _logger;

    public async Task<Order> CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("CreateOrder");
        activity?.SetTag("order.customer_id", request.CustomerId);
        activity?.SetTag("order.items_count", request.Items.Count);

        try
        {
            // Логика создания заказа
            var order = new Order { /* ... */ };

            activity?.SetTag("order.id", order.Id);
            activity?.SetStatus(ActivityStatusCode.Ok);

            return order;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex);
            throw;
        }
    }
}
```

### Propagation Context

```csharp
// Передача контекста между сервисами
public class TracingDelegatingHandler : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken ct)
    {
        // OpenTelemetry автоматически добавляет traceparent header
        // Но можно добавить кастомные headers:
        var activity = Activity.Current;
        if (activity != null)
        {
            request.Headers.Add("X-Correlation-Id", activity.TraceId.ToString());
        }

        return await base.SendAsync(request, ct);
    }
}
```

## Custom Metrics

### Определение метрик

```csharp
public static class ApplicationMetrics
{
    private static readonly Meter Meter = new("MyService", "1.0.0");

    // Counter
    public static readonly Counter<long> OrdersCreated = Meter.CreateCounter<long>(
        "orders_created_total",
        "orders",
        "Total number of orders created");

    // Histogram
    public static readonly Histogram<double> OrderProcessingDuration = Meter.CreateHistogram<double>(
        "order_processing_duration_seconds",
        "seconds",
        "Order processing duration");

    // Observable Gauge
    public static readonly ObservableGauge<int> ActiveConnections = Meter.CreateObservableGauge(
        "active_connections",
        () => ConnectionManager.GetActiveCount(),
        "connections",
        "Number of active connections");
}

// Использование
ApplicationMetrics.OrdersCreated.Add(1, new KeyValuePair<string, object?>("status", "completed"));

using (ApplicationMetrics.OrderProcessingDuration.StartTimer())
{
    await ProcessOrderAsync(order, ct);
}
```

### Регистрация кастомных метрик

```csharp
builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics => metrics
        .AddMeter("MyService")  // Регистрируем наш Meter
        .AddAspNetCoreInstrumentation()
        // ...
    );
```

## Health Checks

### Настройка Health Checks

```csharp
builder.Services.AddHealthChecks()
    // Database
    .AddNpgSql(
        connectionString: builder.Configuration.GetConnectionString("Database")!,
        name: "postgresql",
        tags: new[] { "db", "ready" })
    // Redis
    .AddRedis(
        redisConnectionString: builder.Configuration.GetConnectionString("Redis")!,
        name: "redis",
        tags: new[] { "cache", "ready" })
    // RabbitMQ
    .AddRabbitMQ(
        rabbitConnectionString: builder.Configuration.GetConnectionString("RabbitMQ")!,
        name: "rabbitmq",
        tags: new[] { "messaging", "ready" })
    // Elasticsearch
    .AddElasticsearch(
        elasticsearchUri: builder.Configuration["Elasticsearch:Url"]!,
        name: "elasticsearch",
        tags: new[] { "search", "ready" })
    // Custom check
    .AddCheck<ExternalApiHealthCheck>("external-api", tags: new[] { "external" });

// Endpoints
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // Простая проверка - приложение живо
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
```

### Custom Health Check

```csharp
public class ExternalApiHealthCheck : IHealthCheck
{
    private readonly HttpClient _httpClient;

    public ExternalApiHealthCheck(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("ExternalApi");
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/health", ct);

            if (response.IsSuccessStatusCode)
                return HealthCheckResult.Healthy("External API is healthy");

            return HealthCheckResult.Degraded($"External API returned {response.StatusCode}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("External API is unavailable", ex);
        }
    }
}
```

## Structured Logging с Traces

```csharp
// В appsettings.json
{
  "Serilog": {
    "Enrich": ["FromLogContext", "WithSpan"],
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] [{TraceId}] {Message:lj}{NewLine}{Exception}"
        }
      }
    ]
  }
}

// Автоматически добавляет TraceId и SpanId в логи
_logger.LogInformation("Order {OrderId} created for customer {CustomerId}", order.Id, customerId);
// Output: [14:30:00 INF] [abc123...] Order 123 created for customer 456
```

## Prometheus Metrics Format

```
# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",endpoint="/api/products",le="0.1"} 100
http_request_duration_seconds_bucket{method="GET",endpoint="/api/products",le="0.5"} 150
http_request_duration_seconds_sum{method="GET",endpoint="/api/products"} 45.5
http_request_duration_seconds_count{method="GET",endpoint="/api/products"} 160

# HELP orders_created_total Total number of orders
# TYPE orders_created_total counter
orders_created_total{status="completed"} 1234
orders_created_total{status="failed"} 56
```

## Best Practices

1. **Tracing**
   - Используйте semantic conventions (http.method, db.system)
   - Не создавайте span для каждого метода
   - Добавляйте контекст через SetTag
   - Обрабатывайте исключения в spans

2. **Metrics**
   - Используйте стандартные имена (snake_case)
   - Добавляйте единицы измерения (_seconds, _bytes)
   - Ограничивайте cardinality labels
   - Counter для событий, Histogram для durations

3. **Health Checks**
   - Разделяйте liveness и readiness
   - Не делайте тяжёлые проверки в liveness
   - Используйте timeouts
   - Кэшируйте результаты при необходимости
