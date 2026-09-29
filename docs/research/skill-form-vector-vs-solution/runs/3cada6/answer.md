Провёл ревью MR (весь каталог — новый outbox-воркер). Основные находки записаны в `/Users/anonymous/.cache/research/runs/3cada6/work/_answer.md`, ниже — тот же список.

## Критично

1. **OutboxWorker.cs (конструктор, `ExecuteAsync`) / Program.cs:10** — используется `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>`. Значение кешируется на старте синглтона; правка `MaxInFlight`/`MaxBatchSize` без рестарта **не подхватится**, хотя это прямое требование MR.

2. **Program.cs:11** — `Configure<SmtpOptions>(GetSection("Mail"))`, а во всех appsettings секция называется `"Smtp"`. `SmtpOptions` никогда не забиндится, `SmtpMailSender` упадёт при первой отправке.

3. **ThrottleService.cs:`WaitAsync`** — читает `"Throttle:MessagesPerMinute"`, а ключ в конфиге — `"Throttle:PerMinute"`. `GetValue<int>` вернёт `0` → `60_000 / perMinute` → `DivideByZeroException` на каждой отправке.

4. **OutboxWorker.cs:`ProcessBatchAsync`** — `m.SentAt = now;` выставляется **до** реальной отправки и не откатывается в `catch`. Проваленные отправки навсегда помечаются как отправленные, `Attempts`/`MaxRetries` не работают — потеря уведомлений без ретраев.

5. **Options/OutboxOptions.cs (`PollInterval`) + OutboxWorker.cs:33** — имя настройки без единицы; код трактует `PollInterval=500` как секунды (`FromSeconds`), хотя по описанию MR ожидается опрос раз в 0.5 сек (похоже на миллисекунды). Воркер опрашивает outbox раз в ~8.3 минуты вместо раза в полсекунды.

6. **appsettings.Production.json:3,16** — реальные секреты закоммичены в открытом виде (пароль БД, ключ SMTP-релея).

## Высокая

7. **Program.cs / OutboxOptionsValidator.cs** — валидатор реализован и покрыт тестами, но не зарегистрирован в DI (нет `AddSingleton<IValidateOptions<OutboxOptions>,...>`/`ValidateOnStart()`) — невалидная конфигурация не отлавливается при старте.

8. **OutboxOptionsValidator.cs** — нет проверки инварианта `MinBatchSize <= MaxBatchSize`. В `appsettings.Production.json` реально `MinBatchSize=200 > MaxBatchSize=100`, из-за чего адаптивный батчинг в проде тихо отключается.

9. **appsettings.Staging.json:3** — `${NOTIFY_DB_PASSWORD}` внутри строки подключения не раскрывается стандартным конфиг-пайплайном (нет провайдера для такой интерполяции) — connection string в Staging будет битым.

## Средняя

10. **appsettings.Staging vs Production (`Outbox:MaxInFlight`)** — Staging=20, Production=5: стейджинг агрессивнее прода, что противоречит принятому правилу.

11. **Options/SmtpOptions.cs** — non-nullable `Host`/`FromAddress` без значения и без валидатора; ошибка конфигурации проявится только в рантайме, а не на старте.

12. **tests/OutboxOptionsValidatorTests.cs** — не привязан к какому-либо `.csproj`/`.sln` (в MR только Worker-проект без xUnit) — тест не компилируется и не запускается в CI.

13. **OutboxWorker.cs:`ProcessBatchAsync`** — выбор и захват сообщений не атомарны, без построчной блокировки/токена конкурентности — при нескольких репликах воркера возможна гонка и дублирующая отправка письма.