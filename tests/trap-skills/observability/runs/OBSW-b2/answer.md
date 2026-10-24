Задача OB-1 выполнена в `services/orders-api`, без коммита. Сборки нет, поэтому код не компилировался и не запускался.

**Что сделано**
- **Пакеты.** В `OrdersApi.csproj` добавлены четыре пакета OpenTelemetry версий из задачи и `Serilog.Enrichers.Span` 3.1.0.
- **Трассы.** Есть span `orders.create` в `OrderService`, источник `Npgsql` для запросов к БД, ASP.NET Core и экспорт по OTLP. При исключении span получает статус `Error` и запись исключения.
- **Пробы вне трасс.** Пути `/health*` и `/metrics` исключены из трассировки.
- **Метрики.** Счётчик `orders.created` с тегами `channel` и `status` и гистограмма `orders.create.duration` в секундах. Статусы: `new`, `rejected` (пустой заказ) и `failed`. Метрики отдаются через Prometheus на `/metrics`.
- **Канал.** Значение `channel` приходит из тела запроса, поэтому всё, кроме `web`, `mobile` и `partner`, сворачивается в `other`. Так метрики не получают лишних серий.
- **Health.** `/health/live` не проверяет зависимости, `/health/ready` проверяет Postgres (`select 1`) и Redis (ping). У каждой проверки свой дедлайн 2 с, результат кэшируется на 10 с, так что частые пробы не нагружают зависимости.
- **Redis.** Для проверки добавлен `IConnectionMultiplexer` с `AbortOnConnectFail=false`, чтобы недоступный Redis не мешал старту сервиса.
- **Логи.** Подключён `.Enrich.WithSpan()`, а в шаблон консоли добавлены `trace=` и `span=`.

Эндпоинт OTLP берётся из переменных `OTEL_EXPORTER_OTLP_ENDPOINT` и `OTEL_EXPORTER_OTLP_PROTOCOL`. Их нужно задать в манифесте Kubernetes.

Новый код лежит в `Observability/` (`OrdersTelemetry.cs`, `HealthChecks.cs`), остальное — правки в `Program.cs` и `Orders/OrderService.cs`.