---
name: observability
description: OpenTelemetry-инструментация сервиса - трассы, метрики, health-проверки, связь логов с трассами. Активируется при opentelemetry, tracing, observability, prometheus, metrics, health check, span, trace context, OTLP, serilog enrichment
---

# Observability

Решение по документации версии из манифеста проекта; пункт - ситуация, которую исполнитель не заподозрит.

- Span завершён исключением без статуса `Error` и записи исключения.
- Запросы health-проб попадают в трассы.
- Проверка health без собственного дедлайна.
- Результат проверок health не переиспользуется между пробами.
- Логи без `TraceId` и `SpanId` активной трассы.
