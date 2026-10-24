Наблюдаемость в `services/orders-api` добавлена, ничего не закоммичено. Сборки нет, поэтому код не компилировался и не запускался.

- **Пакеты:** в `OrdersApi.csproj` добавлены пять пакетов из задачи в указанных версиях.
- **Трассировка:** `Program.cs` подключает OpenTelemetry с трассами ASP.NET Core, Npgsql (`AddSource("Npgsql")`) и экспортом по OTLP. Запросы к `/health` и `/metrics` в трассы не попадают. Адрес OTLP и имя сервиса можно задать через `OTEL_EXPORTER_OTLP_ENDPOINT` и `OTEL_SERVICE_NAME`; имя по умолчанию — `orders-api`.
- **Метрики:** `Observability/OrdersTelemetry.cs` задаёт счётчик `orders_created` с метками `channel` и `status` и гистограмму `orders_create_duration` в секундах. Они доступны для Prometheus на `/metrics`, туда же идут метрики ASP.NET Core.
- **Каналы и статусы:** канал кроме `web`, `mobile`, `partner` записывается как `other`, чтобы не раздувать число значений метки. Статус — `new`, `rejected` (пустой заказ) или `error` (любая другая ошибка).
- **Создание заказа:** `Orders/OrderService.cs` открывает span `CreateOrder` с тегами канала, id и статуса, при ошибке ставит ему статус Error и записывает метрики.
- **Проверки состояния:** `Observability/HealthChecks.cs` проверяет Postgres (`select 1` по `ConnectionStrings:Orders`) и Redis (ping по `ConnectionStrings:Redis`). Redis подключается лениво, с `AbortOnConnectFail=false` и таймаутом 2 с.
- **Эндпоинты для Kubernetes:** `/health/live` не обращается к зависимостям и отвечает всегда, `/health/ready` проверяет Postgres и Redis.
- **Логи:** `Enrich.WithSpan()` из `Serilog.Enrichers.Span` добавляет `TraceId` и `SpanId`, а шаблон консольного вывода печатает их как `trace=` и `span=`. Лог заказа теперь находится по id трассы.

Консольный вывод Serilog заменён на текстовый шаблон с `trace` и `span`. Если Seq забирает логи с консоли в JSON, формат нужно согласовать с платформенной командой.

Трассировки Redis нет: пакета для неё в зафиксированном стеке нет.