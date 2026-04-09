---
name: observability
description: OpenTelemetry, distributed tracing, metrics, health checks — ловушки. Активируется при opentelemetry, tracing, observability, prometheus, metrics, health check, grafana, jaeger, zipkin, span, trace context, OTLP, prom-client, datadog
---

# Observability — ловушки и anti-patterns

## Tracing

### Span на каждый метод
Плохо: `StartActivity("Validate")`, `StartActivity("Map")`, `StartActivity("Save")` — три микро-spans на одну операцию
Правильно: один span на бизнес-операцию: `StartActivity("CreateOrder")` с тегами `order.customer_id`, `order.items_count`
Почему: микро-spans = шум в Jaeger/Zipkin, overhead на создание/export, затрудняют поиск реальных bottleneck

### Span без контекста ошибки
Плохо: span завершается без `SetStatus(Error)` и `RecordException` при exception
Правильно: `catch` блок: `activity?.SetStatus(ActivityStatusCode.Error, ex.Message)` + `activity?.RecordException(ex)`
Почему: без статуса ошибки span выглядит "зеленым" в trace UI. Проблема невидима в дашборде ошибок

### ActivitySource создается в методе
Плохо: `new ActivitySource("MyService")` внутри метода — новый instance каждый вызов
Правильно: `private static readonly ActivitySource Source = new("MyService")` — static readonly
Почему: каждый `new ActivitySource` регистрируется в глобальном listener, не удаляется. Memory leak + дубли spans

### Health endpoints в traces
Плохо: `AddAspNetCoreInstrumentation()` без фильтра — `/health/live` каждые 10 сек = тысячи spans
Правильно: `options.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health")`
Почему: health check spans — шум, раздувают storage, маскируют реальные запросы в trace UI

## Health Checks

### Liveness проверяет внешние зависимости
Плохо: `/health/live` проверяет БД/Redis — при падении зависимости Kubernetes рестартит ВСЕ поды
Правильно: liveness: `Predicate = _ => false` (просто 200 OK). Readiness: `check.Tags.Contains("ready")`
Почему: БД упала -> liveness fail -> restart всех подов -> cascade failure. Рестарт не починит упавшую БД

### Один endpoint для liveness и readiness
Плохо: `/health` один endpoint для обоих проверок
Правильно: `/health/live` (процесс жив) + `/health/ready` (зависимости готовы)
Почему: Kubernetes использует их по-разному: liveness fail = restart, readiness fail = убрать из Service. Смешивание = неправильное поведение

## Metrics

### High cardinality labels
Плохо: `OrdersCreated.Add(1, new("customer_id", customerId), new("order_id", orderId))` — уникальные значения
Правильно: bounded labels: `new("status", "completed")` (~5 значений), `new("region", "eu-west")` (~10 значений)
Почему: каждая уникальная комбинация labels = отдельная time series. Миллионы пользователей = OOM в Prometheus/Grafana

### Meter создается в методе
Плохо: `new Meter("MyService")` внутри метода — новый instance каждый вызов
Правильно: `private static readonly Meter AppMeter = new("MyService")` — static readonly
Почему: аналогично ActivitySource — утечка памяти, дублирование метрик

### Неправильный тип метрики
Плохо: Gauge для cumulative count (`orders_total`) или Counter для значения которое падает (`active_connections`)
Правильно: Counter для монотонно растущих, Gauge для текущих значений, Histogram для распределений
Почему: Counter который уменьшается = невалидные данные в Prometheus. rate() на Gauge не имеет смысла

### Метрики без суффикса единиц
Плохо: `request_duration`, `response_size` — непонятно секунды или миллисекунды, байты или килобайты
Правильно: `request_duration_seconds`, `response_size_bytes` + snake_case
Почему: OpenMetrics convention. Без суффикса Grafana дашборды показывают числа без контекста, ошибки в расчетах

## Связь логов и traces

### Логи без TraceId
Плохо: `_logger.LogInformation("Order {OrderId} created", order.Id)` — нет связи с trace
Правильно: Serilog enrichment `WithSpan()` — автоматически добавляет TraceId/SpanId ко всем логам
Почему: без TraceId невозможно найти все логи одного запроса в Seq/Kibana. Клик по TraceId -> весь distributed trace

## Чек-лист

- ActivitySource и Meter — static readonly
- Spans на бизнес-операции, не на каждый метод
- Health endpoints отфильтрованы из traces
- Liveness = процесс жив, Readiness = зависимости готовы
- Labels — bounded cardinality (не userId/orderId)
- Метрики: snake_case + суффикс единицы (_seconds, _bytes)
- Логи enriched с TraceId (WithSpan)
