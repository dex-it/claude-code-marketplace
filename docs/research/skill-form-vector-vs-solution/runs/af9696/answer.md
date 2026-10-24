Провёл ревью MR. Основные находки (полный текст также записан в `_answer.md`):

**Critical**
1. `OutboxWorker.ProcessBatchAsync` — `SentAt` коммитится в БД до фактической отправки, а при ошибке не сбрасывается → письма после первого же сбоя навсегда считаются «отправленными», retry-механизм мёртв.
2. `ThrottleService.WaitAsync` — читает ключ `Throttle:MessagesPerMinute`, а в конфигах секция называется `Throttle:PerMinute` → всегда `DivideByZeroException`, из-за находки №1 это делает рассылку полностью нерабочей.
3. `Program.cs` — `Configure<SmtpOptions>` биндится из секции `"Mail"`, а в appsettings она называется `"Smtp"` → `SmtpOptions` никогда не заполняется.
4. `OutboxWorker` использует `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>` — прямое нарушение требования MR о live-reload лимитов без рестарта.
5. `OutboxWorker.ExecuteAsync` — `Task.Delay(TimeSpan.FromSeconds(o.PollInterval))` при значении `PollInterval=500` (задумано как мс) даёт опрос раз в ~8 минут вместо раз в полсекунды; корень — отсутствие единицы измерения в имени настройки.
6. `appsettings.Production.json` — в репозитории закоммичены боевые секреты открытым текстом (пароль БД, пароль/ключ SMTP-релея).

**High**
7. `OutboxOptionsValidator` не проверяет инвариант `MinBatchSize <= MaxBatchSize`, а в Production он реально нарушен (200 > 100).
8. Валидатор опций нигде не зарегистрирован в DI, `.ValidateOnStart()` не вызван — валидация мёртвый код.
9. `appsettings.Staging.json` использует плейсхолдер `${NOTIFY_DB_PASSWORD}`, но подстановки переменных внутри строки конфигурации в проекте нет — подключение к Staging БД будет падать.

**Medium**
10. Staging `MaxInFlight=20` агрессивнее Production `MaxInFlight=5` — похоже на перепутанные значения.
11. `SmtpOptions.Host/FromAddress` non-nullable без `required` и без отдельного валидатора — тихий NRE вместо явного фейла при старте.

**Low**
12. `Outbox:MaxRetries=5` продублирован одинаковым значением во всех трёх appsettings-файлов без надобности.