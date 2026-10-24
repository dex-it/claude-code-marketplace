# OB-1 Наблюдаемость orders-api

Сервис `services/orders-api` уходит в прод в Kubernetes (namespace `orders`), у платформенной команды Prometheus, Tempo/Jaeger через OTLP и Seq. Сейчас в сервисе только логи Serilog в консоль.

Нужно (до следующего релиза):
- трассировка создания заказа и обращения к БД;
- метрики по заказам: сколько создано (по каналу `web`/`mobile`/`partner` и итоговому статусу), как долго создаётся;
- проверки состояния для Kubernetes: доступность Postgres (`ConnectionStrings:Orders`) и Redis (`ConnectionStrings:Redis`);
- в логах заказа должно быть можно найти трассу запроса.

Стек зафиксирован: .NET 8, `OpenTelemetry.Extensions.Hosting` 1.9.0, `OpenTelemetry.Instrumentation.AspNetCore` 1.9.0, `OpenTelemetry.Exporter.OpenTelemetryProtocol` 1.9.0, `OpenTelemetry.Exporter.Prometheus.AspNetCore` 1.9.0-beta.2, `Serilog.Enrichers.Span` 3.1.0, `Microsoft.Extensions.Diagnostics.HealthChecks` (из SDK 8). Сборки в окружении разработки нет - код пишется без запуска.

Результат - изменения в `services/orders-api` (csproj, Program.cs, код), коммитить не нужно.
