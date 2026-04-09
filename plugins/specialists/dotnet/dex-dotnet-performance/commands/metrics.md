---
description: Получение и анализ метрик из Prometheus/Grafana
allowed-tools: Bash, Read, Grep
---

# /metrics

Получение и анализ метрик из Prometheus и Grafana.

## Цель

Запросить и проанализировать метрики приложения: HTTP performance, resource usage, database, error rates.

## Сценарии

- `/metrics` -- общий обзор всех ключевых метрик
- `/metrics latency` -- анализ latency (P50, P95, P99)
- `/metrics errors` -- error rate и top ошибок
- `/metrics resources` -- CPU/Memory usage по сервисам
- `/metrics custom [query]` -- произвольный PromQL запрос

## Ключевые метрики

1. **HTTP Performance** -- request rate, latency percentiles (P50/P95/P99), error rate, slow requests
2. **Application** -- active connections, GC collections, thread pool, exception rate
3. **Database** -- active connections, query execution time, operations rate
4. **Infrastructure** -- CPU usage by container, memory usage, network I/O

## Формат вывода

Таблица Metric | Value для каждой группы. Включить: top slow endpoints, resource usage по сервисам, active alerts, trends vs yesterday (request rate, latency, error rate). В конце -- рекомендации по обнаруженным проблемам.

## Ограничения

- Источники: Prometheus ($PROMETHEUS_URL) и Grafana ($GRAFANA_URL + $GRAFANA_API_KEY)
- Период по умолчанию: последний час
- Для range queries использовать step=60
- Рекомендуемые Grafana dashboards: ASP.NET Core (10915), PostgreSQL (9628), Redis (763), RabbitMQ (10991), Kubernetes (315)
