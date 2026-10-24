Наблюдаемость для `orders-api` написана, коммита нет. Сборки нет, так что код не компилировался и не запускался.

**Что сделано**
- **Пакеты:** в `OrdersApi.csproj` добавлены пакеты OpenTelemetry и `Serilog.Enrichers.Span` в версиях из задачи.
- **Трассы:**
  - Есть span `orders.create` с тегами канала и id заказа.
  - Запросы к БД трассирует сам Npgsql 8 (источник `Npgsql`).
  - Экспорт идёт по OTLP через стандартные переменные `OTEL_EXPORTER_OTLP_*`.
  - Запросы `/health*` и `/metrics` в трассы не попадают.
  - При исключении span получает статус `Error` и запись об исключении.
- **Метрики:**
  - Счётчик `orders.created` и гистограмма `orders.create.duration` (в секундах) с метками `channel` и `status` (`new` или `failed`).
  - Канал вне `web`/`mobile`/`partner` пишется как `other`, чтобы не раздувать число меток.
  - Метрики отдаются на `/metrics` для Prometheus.
- **Health:**
  - `/health/live` проверок не выполняет.
  - `/health/ready` проверяет Postgres (`select 1`) и Redis (ping).
  - У каждой проверки дедлайн 2 с, результат кэшируется на 5 с и переиспользуется между пробами.
- **Логи:** добавлен `Enrich.WithSpan()`, а в шаблон консоли добавлены `{TraceId}` и `{SpanId}`, поэтому трассу заказа можно найти по логу.

**Что проверить**
- Для Redis `AbortOnConnectFail=false`, поэтому недоступный Redis не мешает старту сервиса и проявится как `Unhealthy` на `/health/ready`.
- Ошибочные статусы кэшируются на те же 5 с, так что восстановление зависимости видно в пробе с задержкой до 5 с.

Код лежит в `Observability/` (`Telemetry.cs`, `CachedHealthCheck.cs`, `DependencyChecks.cs`), правки внесены в `Program.cs` и `Orders/OrderService.cs`.