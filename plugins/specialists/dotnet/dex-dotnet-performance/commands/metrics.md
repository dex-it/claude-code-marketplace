---
description: Получение и анализ метрик из Prometheus/Grafana
allowed-tools: Bash, Read, Grep
---

# /metrics

Получение и анализ метрик из Prometheus и Grafana.

## Использование

```
/metrics                      # Общий обзор метрик
/metrics latency              # Анализ latency
/metrics errors               # Error rate
/metrics resources            # CPU/Memory usage
/metrics custom [query]       # Custom PromQL запрос
```

## Источники метрик

### 1. Prometheus (напрямую)

```bash
# Instant query
curl -s "$PROMETHEUS_URL/api/v1/query?query=up" | jq

# Range query (последний час)
curl -s "$PROMETHEUS_URL/api/v1/query_range?query=rate(http_requests_total[5m])&start=$(date -d '1 hour ago' +%s)&end=$(date +%s)&step=60" | jq
```

### 2. Grafana (через MCP или API)

```bash
# Datasource query
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/ds/query" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [{
      "datasource": {"type": "prometheus"},
      "expr": "rate(http_requests_total[5m])",
      "refId": "A"
    }],
    "from": "now-1h",
    "to": "now"
  }' | jq
```

## Ключевые метрики

### HTTP Request Metrics

```promql
# Request rate (requests per second)
rate(http_requests_total[5m])

# Request latency (p50, p95, p99)
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# Slow requests (>1s)
rate(http_request_duration_seconds_bucket{le="1"}[5m])
```

### Application Metrics

```promql
# Active connections
dotnet_httpclient_connections_current_total

# GC collections
rate(dotnet_gc_collections_total[5m])

# Thread pool
dotnet_threadpool_threads_count

# Exception rate
rate(dotnet_exceptions_total[5m])
```

### Database Metrics

```promql
# PostgreSQL connections
pg_stat_activity_count

# Query execution time
rate(pg_stat_statements_seconds_total[5m])

# MongoDB operations
rate(mongodb_op_counters_total[5m])
```

### Infrastructure Metrics

```promql
# CPU usage by container
rate(container_cpu_usage_seconds_total[5m]) * 100

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes * 100

# Network I/O
rate(container_network_receive_bytes_total[5m])
rate(container_network_transmit_bytes_total[5m])
```

## Выходной формат

```
Metrics Report
━━━━━━━━━━━━━━
Period: Last 1 hour
Source: Prometheus/Grafana

HTTP Performance:
┌────────────────────┬─────────────┐
│ Metric             │ Value       │
├────────────────────┼─────────────┤
│ Request Rate       │ 1,234 req/s │
│ Latency P50        │ 45ms        │
│ Latency P95        │ 120ms       │
│ Latency P99        │ 350ms       │
│ Error Rate         │ 0.5%        │
│ Success Rate       │ 99.5%       │
└────────────────────┴─────────────┘

Top Slow Endpoints:
┌────────────────────────────┬──────────┬───────────┐
│ Endpoint                   │ P95      │ Calls/min │
├────────────────────────────┼──────────┼───────────┤
│ POST /api/v1/orders        │ 450ms    │ 120       │
│ GET /api/v1/products/search│ 320ms    │ 890       │
│ POST /api/v1/payments      │ 280ms    │ 45        │
└────────────────────────────┴──────────┴───────────┘

Resource Usage:
┌────────────────────┬──────────┬─────────────┐
│ Service            │ CPU      │ Memory      │
├────────────────────┼──────────┼─────────────┤
│ api-gateway        │ 25%      │ 512MB/1GB   │
│ orders-service     │ 45%      │ 768MB/1GB   │
│ products-service   │ 15%      │ 256MB/512MB │
└────────────────────┴──────────┴─────────────┘

Database:
┌────────────────────┬──────────┬─────────────┐
│ Metric             │ Value    │ Status      │
├────────────────────┼──────────┼─────────────┤
│ Active Connections │ 45/100   │ ✅ OK       │
│ Avg Query Time     │ 12ms     │ ✅ OK       │
│ Slow Queries       │ 3/hour   │ ⚠️ WARN     │
└────────────────────┴──────────┴─────────────┘

Alerts (Active):
⚠️ HighMemoryUsage: orders-service memory > 75%
⚠️ SlowEndpoint: /api/v1/orders P95 > 400ms

Trends (vs yesterday):
- Request Rate: ↑ +15%
- Latency P95: ↓ -8%
- Error Rate: ↓ -0.2%

Recommendations:
1. Investigate slow /api/v1/orders endpoint
2. Consider scaling orders-service
3. Review slow database queries
```

## Dashboards

Рекомендуемые Grafana dashboards:
- **ASP.NET Core:** ID 10915
- **PostgreSQL:** ID 9628
- **Redis:** ID 763
- **RabbitMQ:** ID 10991
- **Kubernetes:** ID 315

## Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected (P95 > 500ms)"
```
