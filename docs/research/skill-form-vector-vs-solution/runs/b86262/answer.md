## Итоги ревью

**Critical**
1. `OutboxWorker.ProcessBatchAsync` — `SentAt` проставляется и коммитится до фактической отправки письма; упавшие отправки никогда не переотправляются, письма молча теряются.
2. `Options/OutboxOptions.PollInterval` — имя без единицы: конфиг задуман в мс (500), а код делает `TimeSpan.FromSeconds(...)` → реальный интервал 500 сек вместо 0.5 сек, требование MR нарушено.
3. `Program.cs` — `Configure<SmtpOptions>` биндится на секцию `"Mail"`, а в appsettings секция называется `"Smtp"`; SMTP-настройки никогда не подхватятся.
4. `ThrottleService.WaitAsync` — читает `Throttle:MessagesPerMinute`, а в конфиге ключ `Throttle:PerMinute` → `DivideByZeroException` на первой отправке.
5. `OutboxWorker` — использует `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>`; в singleton-хостед-сервисе значение кэшируется, и требуемая MR «правка на лету без рестарта» не работает.
6. `tests/OutboxOptionsValidatorTests.cs` — лежит внутри каталога `Notify.Worker.csproj` без отдельного тест-проекта/`.sln`, использует `Xunit`, который в csproj не подключён — сборка основного проекта сломается.
7. `appsettings.Production.json` — пароли БД и SMTP закоммичены в открытом виде (в отличие от Staging, где пароль вынесен в `${NOTIFY_DB_PASSWORD}`).

**High**
8. `Program.cs` — `OutboxOptionsValidator` не зарегистрирован в DI и нет `.ValidateOnStart()`, валидация конфигурации при старте не выполняется.
9. `OutboxOptionsValidator.Validate` — нет проверки инварианта `MinBatchSize <= MaxBatchSize`; в Production `MinBatchSize=200 > MaxBatchSize=100`.
10. `Options/SmtpOptions` — non-nullable `Host`/`FromAddress` без `required` и без валидатора; ошибка конфигурации проявится только в рантайме при отправке письма.

**Medium**
11. `appsettings.Staging.json` vs `Production` — Staging `MaxInFlight=20` выше Production `MaxInFlight=5`, причина нигде не зафиксирована.
12. `OutboxWorker.ProcessBatchAsync` — нет атомарного захвата строк outbox (SKIP LOCKED/конкурентный токен), риск двойной отправки при нескольких репликах.

**Low**
13. `appsettings.Staging.json`/`Production.json` — часть значений (`MaxRetries=5` и т.п.) дублирует дефолт из базового `appsettings.json`, лишний шум для будущих правок.

Полный текст с пояснениями сохранён в `/Users/anonymous/.cache/research/runs/b86262/work/_answer.md`.