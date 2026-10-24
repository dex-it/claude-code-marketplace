Провёл ревью MR. Результат записан в `/Users/anonymous/.cache/research/runs/d1a943/work/_answer.md`, ниже — тот же список.

## Критические
1. **`OutboxWorker.ProcessBatchAsync`** — `SentAt` выставляется всем сообщениям батча *до* реальной отправки и не откатывается при ошибке. Упавшие/недоставленные письма помечаются как отправленные и больше никогда не ретраятся — тихая потеря уведомлений.
2. **`OutboxWorker.ExecuteAsync`** — `TimeSpan.FromSeconds(o.PollInterval)`, а в `appsettings.json` `PollInterval: 500` задан явно в миллисекундах (по смыслу ТЗ «раз в полсекунды»). Имя настройки без единицы → реальный опрос раз в ~8.3 минуты вместо раз в 0.5 сек.
3. **`appsettings.Production.json`** — пароль от БД и SMTP-пароль в открытом виде в репозитории.
4. **`ThrottleService.WaitAsync`** — читает ключ `Throttle:MessagesPerMinute`, а в appsettings он называется `Throttle:PerMinute`. `GetValue<int>` вернёт 0 → `60_000 / perMinute` → `DivideByZeroException` при каждой отправке.

## High
5. **`OutboxWorker`** — используется `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>`, поэтому `MaxInFlight`/`MaxBatchSize` не меняются на лету, хотя это явное требование MR.
6. **`Program.cs`** — `OutboxOptionsValidator` нигде не зарегистрирован (`IValidateOptions<T>`), `ValidateOnStart()` отсутствует — валидация не работает.
7. **`OutboxOptionsValidator.Validate`** — нет проверки `MinBatchSize <= MaxBatchSize` (и `MinBatchSize > 0`), а в `appsettings.Production.json` фактически `MinBatchSize:200 > MaxBatchSize:100`; при `MinBatchSize=0` адаптивная логика в воркере может застрять на батче размером 0.
8. **`appsettings.Staging.json`** — `Password=${NOTIFY_DB_PASSWORD}` в connection string: .NET-конфигурация не интерполирует `${...}`, подключение к БД в Staging сломается.

## Medium
9. **`appsettings.Staging.json` vs `Production.json`** — `MaxInFlight` в Staging (20) выше, чем в Production (5): тестовый контур агрессивнее прода.
10. **`Options/SmtpOptions.cs`** — `Host`/`FromAddress` non-nullable без `required` и без `IValidateOptions<SmtpOptions>`; отсутствие значения в конфиге приведёт к необработанному NRE/FormatException в рантайме внутри `SmtpMailSender`, а не к понятной ошибке при старте.