## Итог ревью

**Критические (7):**
1. `Program.cs` — `SmtpOptions` привязан к секции `"Mail"`, а в appsettings секция называется `"Smtp"` → SMTP-настройки никогда не заполняются.
2. `OutboxWorker.ProcessBatchAsync` — `SentAt` проставляется до фактической отправки; при ошибке отправки не откатывается → неудачные отправки молча теряются, ретраи не работают.
3. `ThrottleService.WaitAsync` — читает `Throttle:MessagesPerMinute`, а ключ в конфиге `Throttle:PerMinute` → деление на ноль, падение при первой отправке.
4. `OutboxWorker.ExecuteAsync` — `PollInterval` (500, задумано как мс согласно описанию MR) интерпретируется через `TimeSpan.FromSeconds` → опрос раз в ~8.3 минуты вместо раза в 0.5 сек.
5. `OutboxWorker`/`Program.cs` — используется `IOptions<OutboxOptions>` вместо `IOptionsMonitor`, поэтому `MaxInFlight`/размер пачки не меняются на лету, как требует MR.
6. `appsettings.Production.json`/`Staging.json` — реальные пароли БД и SMTP закоммичены в открытом виде.
7. `tests/OutboxOptionsValidatorTests.cs` неявно попадает в сборку `Notify.Worker.csproj` (SDK-style, авто-glob), но `xunit` нигде не подключён → проект не соберётся.

**Высокие (3):** валидатор не проверяет `MinBatchSize`/инвариант `MinBatchSize<=MaxBatchSize`; `OutboxOptionsValidator` нигде не зарегистрирован и `ValidateOnStart` не вызывается; в Production `MinBatchSize(200) > MaxBatchSize(100)`; Staging `MaxInFlight(20)` агрессивнее Production `(5)` без обоснования.

**Средние (2):** `SmtpOptions` non-nullable поля без валидации на старте; выборка/блокировка outbox-сообщений не атомарна для случая нескольких инстансов воркера.

**Низкие (1):** env-файлы дублируют значения по умолчанию из базового `appsettings.json`.

Полный текст с обоснованиями и привязкой к файлам/методам записан в `/Users/anonymous/.cache/research/runs/25aff8/work/_answer.md`.