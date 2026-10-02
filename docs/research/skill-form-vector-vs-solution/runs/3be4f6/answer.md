Провёл ревью MR (только чтение, код не менял). Основные находки записаны в `/Users/anonymous/.cache/research/runs/3be4f6/work/_answer.md`, ниже — сводка.

## Critical
1. **Program.cs** — `Configure<SmtpOptions>` биндит секцию `"Mail"`, а в appsettings настройки лежат под `"Smtp"` → `SmtpOptions` всегда пустой, письма никогда не уйдут.
2. **ThrottleService.WaitAsync** — читает `Throttle:MessagesPerMinute`, а в конфиге ключ `Throttle:PerMinute` → `perMinute=0` → `DivideByZeroException` на каждом вызове.
3. **OutboxWorker.ProcessBatchAsync** — `SentAt` проставляется до отправки и не откатывается при ошибке → неудачные письма помечаются как отправленные и никогда не ретраятся, `MaxRetries` мёртв.
4. **OutboxWorker.ExecuteAsync** — `Task.Delay(TimeSpan.FromSeconds(o.PollInterval))` при `PollInterval: 500` = 500 секунд вместо требуемых «раз в полсекунды» (unit confusion, имя без единицы измерения).
5. **OutboxOptionsValidator** написан и покрыт тестами, но нигде не зарегистрирован в DI, `ValidateOnStart()` не вызван — правило никогда не исполняется в проде.
6. **appsettings.Production.json** — пароль БД и SMTP-пароль закоммичены в открытом виде (staging для пароля БД корректно использует `${NOTIFY_DB_PASSWORD}`, prod — нет).

## High
7. `MaxInFlight`: staging (20) > production (5) без объяснения — staging агрессивнее прода.
8. `MinBatchSize (200) > MaxBatchSize (100)` в Production — невалидный инвариант, тихо отключает адаптивную пакетную обработку в `OutboxWorker`, валидатор это не проверяет.
9. `SmtpOptions.Host/FromAddress` — non-nullable без `required` при `Nullable enable`, из-за бага №1 реально долетают `null` до рантайма.

## Medium
10. `OutboxWorker`/`Program.cs` используют `IOptions<OutboxOptions>` вместо `IOptionsMonitor` — прямо противоречит требованию MR «меняется на лету без рестарта».
11. `ThrottleService` читает конфиг напрямую через `IConfiguration`, минуя options-пайплайн и валидацию.
12. Гонка при захвате outbox-строк — нет `FOR UPDATE SKIP LOCKED`/concurrency token, при нескольких инстансах воркера возможна двойная отправка.

## Low
13. Дублирование дефолтных значений в env-файлах (`MaxRetries`, `MaxBatchSize`, `MaxInFlight`).
14. Тесты валидатора не проверяют регистрацию в DI и кросс-field инвариант Min/Max.