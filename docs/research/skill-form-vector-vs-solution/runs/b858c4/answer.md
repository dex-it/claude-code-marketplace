Ревью проведено, результат также записан в `_answer.md`.

## Критичные
1. **Program.cs** — `Configure<SmtpOptions>(GetSection("Mail"))`, а в конфигах секция называется `Smtp`. SMTP-опции всегда пустые, рассылка не работает вообще.
2. **ThrottleService.WaitAsync** — читает `Throttle:MessagesPerMinute`, в конфиге ключ `Throttle:PerMinute`. `GetValue<int>` вернёт 0 → `DivideByZeroException` на каждой отправке.
3. **OutboxWorker.ExecuteAsync** — `TimeSpan.FromSeconds(o.PollInterval)` при `"PollInterval": 500` и требовании «раз в полсекунды» (500 мс). Опрос будет раз в ~8.3 минуты вместо 0.5 сек — классическая unit confusion, имя без суффикса единицы.
4. **OutboxWorker** — использует `IOptions<OutboxOptions>`, хотя MR явно требует горячую смену `MaxInFlight`/`MaxBatchSize` без рестарта; нужен `IOptionsMonitor<OutboxOptions>`.
5. **OutboxWorker.ProcessBatchAsync** — `SentAt = now` проставляется до реальной отправки и не откатывается при исключении в `catch`; неудачные письма навсегда помечаются как отправленные, retry/`MaxRetries` мертвы, сообщения теряются.
6. **appsettings.Production/Staging.json** — пароли БД и SMTP-релея закоммичены в открытом виде (`Kx7!pQ2vR9wz`, `rl_live_9f3a1c77e2b04d6d`).

## Высокие
7. **Program.cs** — `OutboxOptionsValidator` покрыт тестами, но не зарегистрирован в DI, `ValidateOnStart()` не вызван — валидация никогда не исполняется.
8. **OutboxWorker.ExecuteAsync** — инвариант `MinBatchSize < MaxBatchSize` защищён тихим `if`, при нарушении адаптивный батчинг молча отключается без сигнала.
9. **appsettings.Production.json** — `MinBatchSize: 200 > MaxBatchSize: 100`, а валидатор это соотношение вообще не проверяет.
10. **appsettings.Staging.json** — `MaxInFlight: 20` выше, чем в Production (`5`), без пояснения — staging агрессивнее прод.

## Средние
11. **Options/SmtpOptions.cs** — non-nullable `Host`/`FromAddress` без `required` при `Nullable enable`.
12. **Options/OutboxOptions.cs** — `PollInterval` без единицы измерения в имени (корень бага №3).

## Низкие
13. Дублирование дефолтных значений (`MaxRetries`, `MaxBatchSize`) в env-файлах вместо только отклонений.
14. Выборка и блокировка батча в `ProcessBatchAsync` не атомарны на уровне БД (нет `SKIP LOCKED`) — риск двойной отправки при нескольких инстансах воркера.