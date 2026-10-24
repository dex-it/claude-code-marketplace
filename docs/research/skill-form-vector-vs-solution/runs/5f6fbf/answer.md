Провёл ревью MR (Outbox-воркер), результат записан в `_answer.md`. Основные находки:

**Critical**
1. `OutboxWorker.ExecuteAsync` — `PollInterval` без единицы в имени, трактуется как секунды (`TimeSpan.FromSeconds`), хотя значение `500` в конфиге задумано как мс — воркер реально опрашивает раз в ~8 минут вместо 0.5 сек, как требует MR.
2. `ThrottleService.WaitAsync` — читает ключ `Throttle:MessagesPerMinute`, а в appsettings он `Throttle:PerMinute` → `perMinute` всегда `0` → `DivideByZeroException` при каждой отправке.
3. `Program.cs` — `OutboxOptionsValidator` нигде не зарегистрирован в DI и `.ValidateOnStart()` не вызван — вся валидация опций мёртвый код.
4. `appsettings.Production.json` — `MinBatchSize(200) > MaxBatchSize(100)`, реальное нарушение инварианта, незамеченное из-за находки 3.
5. `appsettings.Production.json` — реальные пароль БД и SMTP-пароль закоммичены в открытом виде.

**High**
6. `OutboxWorker` использует `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>` — MaxInFlight/размер пачки не могут меняться «на лету», как явно требует MR.
7. `appsettings.Staging.json` — плейсхолдер `${NOTIFY_DB_PASSWORD}` не подставляется стандартными провайдерами .NET, пароль к БД будет буквальной строкой.
8. Staging (`MaxInFlight=20`) агрессивнее Production (`MaxInFlight=5`).
9. `OutboxOptionsValidator` не проверяет `MinBatchSize > 0`, `MinBatchSize <= MaxBatchSize`, `PollInterval > 0`.

**Medium**: нет валидатора для `SmtpOptions`; `ThrottleService` в обход паттерна Options читает `IConfiguration` напрямую без защиты от нуля.

**Low**: тестовый файл `tests/OutboxOptionsValidatorTests.cs` не привязан ни к одному проекту (нет `.sln`/тестового `.csproj`); `PollInterval` не переопределён ни в одном env-файле.