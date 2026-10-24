## Ревью MR: Notify.Worker

### Critical
1. **`OutboxWorker.ProcessBatchAsync`** — `m.SentAt = now` выставляется всем сообщениям пачки *до* вызова `sender.SendAsync`, а в `catch` при ошибке отправки сбрасывается только `Attempts`, `SentAt` не откатывается. Провалившиеся письма навсегда исчезают из выборки (`SentAt == null`) — retry/`MaxRetries` фактически мёртвый код, письма молча теряются.
2. **`Program.cs`** — `Configure<SmtpOptions>(...GetSection("Mail"))`, а в appsettings секция называется `"Smtp"`. `SmtpOptions` никогда не заполняется.
3. **`ThrottleService.WaitAsync`** — читает `Throttle:MessagesPerMinute`, в конфиге ключ `Throttle:PerMinute`. `GetValue<int>` вернёт `0` → `60_000/0` → `DivideByZeroException` при каждой отправке.
4. **`OutboxOptions.PollInterval` / `OutboxWorker.ExecuteAsync`** — имя без единицы измерения; в appsettings задано `500` (мс, по смыслу MR «раз в полсекунды»), а код делает `TimeSpan.FromSeconds(o.PollInterval)` — реальный интервал 500 секунд вместо 0.5 сек.
5. **`OutboxWorker`** использует `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>` — MR требует смену `MaxInFlight`/размера пачки без рестарта, но `IOptions<T>.Value` кэшируется один раз при старте singleton-сервиса.
6. **`appsettings.Production.json`** — пароли БД и SMTP-релея закоммичены открытым текстом.
7. **`appsettings.Staging.json`** — `${NOTIFY_DB_PASSWORD}` не подставляется стандартной .NET-конфигурацией (нет такого провайдера в `Program.cs`); в Staging подключение к БД будет падать.
8. **`tests/OutboxOptionsValidatorTests.cs`** — нет отдельного тестового `.csproj`, единственный проект (`Notify.Worker.csproj`, SDK Worker) не ссылается на xunit и не исключает `tests/**` — сборка ломается.

### High
9. **`Program.cs`** — `OutboxOptionsValidator` нигде не зарегистрирован (нет `IValidateOptions<OutboxOptions>` в DI, нет `ValidateOnStart()`) — валидатор и тесты к нему мёртвый код.
10. **`OutboxOptionsValidator.Validate`** — нет проверки инварианта `MinBatchSize <= MaxBatchSize`; в `appsettings.Production.json` `MinBatchSize: 200 > MaxBatchSize: 100` — адаптивный батчинг молча отключается вместо явной ошибки при старте.
11. **`Options/SmtpOptions.cs`** — non-nullable `Host`/`FromAddress` без `required` и без собственного валидатора; в связке с дефектом №2 ничего не остановит сервис при пустом SMTP-конфиге, ошибка вылезет как `NullReferenceException` в рантайме.

### Medium
12. **`appsettings.Staging.json` vs `appsettings.Production.json`** — `MaxInFlight`: Staging 20 против Production 5, без комментария/обоснования (Staging агрессивнее прода).
13. **`OutboxWorker.ProcessBatchAsync`** — захват строк outbox (select + update) не атомарен, без транзакции/`FOR UPDATE SKIP LOCKED`; при нескольких инстансах воркера возможна двойная отправка.

### Low
14. **`appsettings.Staging.json`/`appsettings.Production.json`** — оверрайды `MaxRetries: 5` (и `MaxInFlight: 5` в Production) совпадают со значением по умолчанию — похоже на забытое изменение, стоит проверить осознанность.

Полный текст с деталями и цитатами сохранён в `/Users/anonymous/.cache/research/runs/d32ad5/work/_answer.md`.