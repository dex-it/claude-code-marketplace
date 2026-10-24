Наблюдаемость для `services/orders-api` написана, но сборки в окружении нет, так что код не компилировался и не запускался. Ничего не закоммичено.

**Что сделано**
- **Пакеты:** в `OrdersApi.csproj` добавлены OpenTelemetry (Extensions.Hosting, Instrumentation.AspNetCore, OTLP — все 1.9.0; Prometheus.AspNetCore 1.9.0-beta.2) и `Serilog.Enrichers.Span` 3.1.0.
- **Трассы:** есть спаны `orders.create`, `orders.save` и `orders.find`. Для БД я сделал свои спаны с тегами `db.system` и `db.operation`, а не подключал пакет инструментации Npgsql. Его нет в зафиксированном стеке. Если нужны спаны самих SQL-команд, пакет придётся добавить.
- **Метрики:** `orders.created` — счётчик с тегами `channel` и `status`. `orders.create.duration` — гистограмма в секундах. Канал вне `web`/`mobile`/`partner` пишется как `other`, чтобы значение из тела запроса не раздувало число меток. Метрики уходят в OTLP и на `/metrics` для Prometheus.
- **Health-проверки:**
  - `/health/live` проверок не выполняет.
  - `/health/ready` проверяет Postgres (`select 1`) и Redis (ping).
  - У каждой проверки свой дедлайн 3 с, у регистрации — запас 4 с.
  - Redis подключается с `AbortOnConnectFail=false`, поэтому сервис стартует, даже если Redis недоступен, а `/health/ready` покажет проблему.
- **Логи:** добавлен `Enrich.WithSpan()`, а в шаблон консольного вывода — `{TraceId} {SpanId}`. Без этого в консольном шаблоне по умолчанию trace id не виден.

**По правилам команды (`rules/SKILL.md`)**
- Если спан завершается исключением, ему ставится статус `Error` и добавляется событие `exception`. Это делает хелпер `RecordError`, он вызывается в `OrderService` и в репозитории. Событие собрано вручную, потому что я не был уверен, что в 1.9.0 есть готовый `AddException`.
- Запросы к `/health*` и `/metrics` исключены из трассировки фильтром в `AddAspNetCoreInstrumentation`.

**Что проверить при первой сборке**
- Сигнатура `AddCheck<T>(..., timeout:)`.
- Работу `PingAsync().WaitAsync`.
- Адрес OTLP-экспортёра: я его не задавал, он берётся из переменных окружения `OTEL_EXPORTER_OTLP_*`, которые платформенная команда должна выставить в деплое.

Новый код в `Observability/Telemetry.cs` и `Observability/HealthChecks.cs`; остальное — правки в `Program.cs`, `Orders/OrderService.cs` и `Orders/OrderRepository.cs`.