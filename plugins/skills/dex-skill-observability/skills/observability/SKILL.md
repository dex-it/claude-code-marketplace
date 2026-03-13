---
name: observability
description: OpenTelemetry, distributed tracing, metrics, health checks в .NET — ловушки. Активируется при opentelemetry, tracing, observability, prometheus, metrics, health check, telemetry
---

# Observability Patterns — ловушки

## Правила

- ActivitySource — static readonly (один на класс/модуль, не new каждый раз)
- Meter — static readonly (аналогично)
- Фильтруй health check endpoints из tracing (шум в traces)
- Liveness ≠ Readiness (liveness — процесс жив, readiness — зависимости готовы)
- Label cardinality — не используй userId/orderId как label (взрыв метрик)
- snake_case для метрик + единицы измерения в суффиксе (_seconds, _bytes)

## Анти-паттерны

```csharp
// Плохо — span на каждый метод (шум + overhead)
public async Task<Order> CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
{
    using var span1 = _source.StartActivity("Validate");
    Validate(request);
    span1?.Stop();

    using var span2 = _source.StartActivity("MapToEntity");
    var order = Map(request);
    span2?.Stop();

    using var span3 = _source.StartActivity("SaveToDb");
    await _repo.SaveAsync(order, ct);
    span3?.Stop();
    // 3 микро-spans вместо одного осмысленного
}

// Хорошо — span на бизнес-операцию с контекстом
public async Task<Order> CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
{
    using var activity = ActivitySource.StartActivity("CreateOrder");
    activity?.SetTag("order.customer_id", request.CustomerId);
    activity?.SetTag("order.items_count", request.Items.Count);

    try
    {
        var order = await ProcessOrder(request, ct);
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

// Плохо — high cardinality labels (миллионы комбинаций)
OrdersCreated.Add(1,
    new("customer_id", customerId),   // уникальный на каждого клиента!
    new("order_id", orderId));         // уникальный на каждый заказ!
// Prometheus/Grafana: OOM от миллионов time series

// Хорошо — bounded labels
OrdersCreated.Add(1,
    new("status", "completed"),     // ~5 значений
    new("region", "eu-west"));      // ~10 значений

// Плохо — health check endpoints в traces (шум)
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()); // /health/live вызывается каждые 10 сек → тысячи бесполезных spans

// Хорошо — фильтр health endpoints
.AddAspNetCoreInstrumentation(options =>
{
    options.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health");
    options.RecordException = true;
})

// Плохо — liveness проверяет внешние зависимости
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready") // БД упала → liveness fail → Kubernetes рестартит ВСЕ поды!
});
// БД и так недоступна, рестарт подов ничего не даст, только cascade failure

// Хорошо — liveness = процесс жив, readiness = зависимости готовы
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // никаких проверок, просто 200 OK
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready") // БД, Redis, RabbitMQ
});

// Плохо — логи без TraceId (невозможно связать с trace)
_logger.LogInformation("Order {OrderId} created", order.Id);
// В Seq/Kibana: тысячи логов, как найти связанные?

// Хорошо — Serilog enrichment с TraceId
// appsettings.json: "Enrich": ["FromLogContext", "WithSpan"]
// Output: [14:30:00 INF] [abc123...] Order 123 created
// Теперь клик по TraceId → весь distributed trace
```

## Counter vs Histogram vs Gauge

| Тип | Когда | Пример | НЕ используй для |
|-----|-------|--------|------------------|
| Counter | Монотонно растущее число | orders_total, errors_total | Значений, которые уменьшаются |
| Histogram | Распределение значений | request_duration_seconds | Counts (используй Counter) |
| Gauge | Текущее значение (может расти/падать) | active_connections, queue_size | Cumulative counts |

## Чек-лист

- [ ] ActivitySource и Meter — static readonly
- [ ] Spans на бизнес-операции, не на каждый метод
- [ ] Health endpoints отфильтрованы из traces
- [ ] Liveness = процесс жив (Predicate = _ => false)
- [ ] Readiness = зависимости готовы (tags: "ready")
- [ ] Labels — bounded cardinality (не userId/orderId)
- [ ] Метрики: snake_case + суффикс единицы (_seconds)
- [ ] Логи enriched с TraceId (WithSpan)
