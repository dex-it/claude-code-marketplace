## Итоги ревью

Нашёл 14 дефектов, самые серьёзные — цепочка багов, из-за которой **воркер вообще не сможет отправить ни одного письма**:

**Critical:**
- `OutboxWorker.ProcessBatchAsync` — `SentAt` проставляется до попытки отправки, при ошибке не откатывается → сообщения с ошибкой отправки навсегда выпадают из обработки, ретраев не будет
- `ThrottleService.WaitAsync` — читает `Throttle:MessagesPerMinute`, а в конфиге ключ `Throttle:PerMinute` → деление на 0 при каждой отправке
- `Program.cs` — `SmtpOptions` биндится на секцию `Mail`, а в конфигах секция называется `Smtp` → `Host`/`FromAddress` всегда null
- `OutboxWorker.ExecuteAsync` — `PollInterval: 500` (миллисекунды по смыслу MR) трактуется как `TimeSpan.FromSeconds`, интервал опроса ~8 минут вместо 0.5 сек
- `OutboxWorker` использует `IOptions<OutboxOptions>` вместо `IOptionsMonitor` — MR прямо требует live-reload лимитов без рестарта, а `IOptions<T>.Value` фиксируется один раз
- секреты (пароль БД, live-ключ SMTP-релея) захардкожены в `appsettings.Production.json` и закоммичены в репозиторий

**High:** валидатор `OutboxOptionsValidator` не зарегистрирован в DI и `ValidateOnStart()` не вызван; отсутствует проверка инварианта `MinBatchSize <= MaxBatchSize`, который уже нарушен в `appsettings.Production.json` (200 > 100); тесты в `tests/` не соберутся — нет отдельного тестового проекта с ссылкой на xunit.

**Medium/Low:** нет валидации `PollInterval`/`SmtpOptions`, Staging настроен агрессивнее Production по `MaxInFlight`, Production не переопределяет часть настроек явно, нет защиты от гонки при нескольких инстансах воркера.

Полный список с обоснованиями и severity записан в `/Users/anonymous/.cache/research/runs/75eed7/work/_answer.md`.