---
description: Комплексная проверка здоровья всех сервисов и инфраструктуры
allowed-tools: Bash, Read, Grep
---

# /health-check

**Goal:** Проверить доступность и состояние всех компонентов системы: application, databases, messaging, cache, search, Kubernetes.

**Scenarios:**

- `/health-check` -- все компоненты
- `/health-check db` -- PostgreSQL, MongoDB
- `/health-check messaging` -- RabbitMQ, Kafka
- `/health-check cache` -- Redis
- `/health-check search` -- Elasticsearch
- `/health-check app` -- application endpoints (/health, /health/ready, /health/live)
- `/health-check k8s` -- Kubernetes pods и ресурсы

**Output:**

Таблица по каждой группе: Service | Status (OK/WARN/FAIL) | Details. В конце -- Summary (N OK, N WARN, N FAIL), список warnings и рекомендации.

**Constraints:**

- Использовать переменные окружения для подключений ($DATABASE_URL, $REDIS_URL и т.д.)
- Не падать при недоступности одного сервиса -- продолжать проверку остальных
- Выводить WARN при пороговых значениях (memory > 75%, DLQ > 0)
