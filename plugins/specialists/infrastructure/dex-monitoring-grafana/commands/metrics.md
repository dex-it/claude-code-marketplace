---
description: Получение и анализ метрик из Prometheus/Grafana — request rate, latency, errors, resources
allowed-tools: Bash, Read, Grep
---

# /metrics

Быстрый снимок ключевых метрик приложения.

**Goal:** Получить RED-метрики (Rate, Errors, Duration) и resource usage из Prometheus/Grafana.

**Scenarios:**
- Без аргументов — overview: request rate, error rate, P99 latency, CPU/memory usage
- `latency` — детальный breakdown по endpoints: P50, P95, P99, slow endpoints
- `errors` — error rate по status codes, top error endpoints
- `resources` — CPU, memory, disk, network по pods/containers

**Output:** Таблицы: HTTP performance (endpoint, RPS, error%, P99), resource usage (pod, CPU req/limit/actual, memory req/limit/actual). Warnings для аномальных значений.

**Constraints:**
- Определить datasource (Prometheus direct, Grafana API, MCP) в начале
- PromQL с высоким cardinality — предупредить о нагрузке
