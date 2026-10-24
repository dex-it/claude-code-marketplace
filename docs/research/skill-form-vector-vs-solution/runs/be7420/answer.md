Ревью проведено, полный отчёт записан в `_answer.md`. Ниже — сводка находок.

## Критичные дефекты (блокируют мердж)

1. **`Program.cs`** — `SmtpOptions` биндится из секции `"Mail"`, а в конфигах секция называется `"Smtp"`. Все SMTP-настройки всегда пустые.
2. **`Program.cs`** — `OutboxOptionsValidator` написан и покрыт тестом, но нигде не зарегистрирован в DI, `ValidateOnStart()` не вызван — валидация никогда не выполняется (классический anti-pattern из SKILL.md).
3. **`Program.cs` / `OutboxWorker.ExecuteAsync`** — использован `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>`, хотя MR явно требует live-reload лимитов без рестарта; `IOptions` кэшируется на весь lifetime процесса.
4. **`appsettings.json` + `OutboxWorker.ExecuteAsync`** — `PollInterval: 500` без единицы в имени, а код делает `TimeSpan.FromSeconds(o.PollInterval)`. Реальный интервал — 500 секунд вместо заявленных 0.5 секунды (unit confusion, ×1000).
5. **`ThrottleService.WaitAsync`** — читает ключ `Throttle:MessagesPerMinute`, которого нет (реальный ключ — `Throttle:PerMinute`) → `GetValue<int>` возвращает 0 → `DivideByZeroException` на первом сообщении.
6. **`appsettings.Production.json`** — боевые секреты закоммичены в открытом виде (пароль БД, пароль SMTP-релея), при этом staging для того же пароля уже использует плейсхолдер `${...}`.
7. **`OutboxWorker.ProcessBatchAsync`** — `m.SentAt = now` выставляется для всей пачки *до* попытки отправки и не откатывается при исключении → упавшие отправки никогда не ретраятся, `MaxRetries` фактически не работает.

## High

8. **`OutboxOptionsValidator.cs`** — не проверяется `MinBatchSize > 0` и инвариант `MinBatchSize <= MaxBatchSize`; в `OutboxWorker` этот инвариант используется тихим `if`, который молча отключает адаптивный батчинг. В `appsettings.Production.json` инвариант уже нарушен (`MinBatchSize: 200 > MaxBatchSize: 100`).
9. **`appsettings.Staging.json` vs `Production.json`** — `MaxInFlight`: staging 20 > prod 5, без объяснения — staging не воспроизводит прод-поведение под нагрузкой.
10. **`Options/SmtpOptions.cs`** — `Host`/`FromAddress` non-nullable без `required` при `Nullable enable`; в сочетании с находкой №1 это NRE в рантайме вместо ошибки компиляции.

## Medium

11. **`ThrottleService.WaitAsync`** — независимые `Task.Delay` без общей синхронизации не ограничивают суммарную скорость при `MaxInFlight > 1`, реальный throughput кратно превышает `PerMinute`.
12. **`tests/OutboxOptionsValidatorTests.cs`** — в репозитории нет тестового `.csproj`/`.sln`, файл использует `Xunit`, но не может быть собран/запущен — покрытие тестами иллюзорно.