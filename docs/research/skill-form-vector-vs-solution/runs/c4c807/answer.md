Нашёл 17 дефектов: 5 critical, 6 high, 4 medium, 2 low. Ответ записан в `_answer.md`; код не менял, сборку и тесты не запускал.

## Critical
1. **`appsettings.Production.json`: секреты в репозитории.** В файле открытым текстом лежат пароль БД (`Kx7!pQ2vR9wz`) и пароль SMTP-релея (`rl_live_9f3a1c77e2b04d6d`). Они уже в истории git, поэтому оба нужно ротировать, а затем перенести в env или secret store.
2. **`Program.cs`: `SmtpOptions` читают несуществующую секцию.** Код берёт `GetSection("Mail")`, а в appsettings секция называется `Smtp`. В итоге `Host` и `FromAddress` равны `null`, `Port` равен `0`. Сервис стартует, но каждая отправка падает. Валидации на старте нет: нужен `ValidateDataAnnotations` или валидатор плюс `ValidateOnStart`, модификатор `required` тут не поможет.
3. **`ThrottleService.WaitAsync`: неверный ключ настройки.** Код читает `Throttle:MessagesPerMinute`, а в конфиге ключ `PerMinute`. Получается `0`, и `60_000 / 0` бросает `DivideByZeroException`. Воркер ловит это исключение как неудачную отправку, так что не уходит ни одно письмо.
4. **`OutboxWorker.ProcessBatchAsync`: `SentAt` ставится и сохраняется до отправки.** Если отправка упала, сообщение больше не выбирается из outbox. Ретраев нет, `Attempts`/`MaxRetries` и лиз `LockedUntil` бесполезны. При падении процесса теряется вся пачка.
5. **`OutboxWorker.ExecuteAsync`: `PollInterval` трактуется как секунды.** В конфиге `500`, код делает `TimeSpan.FromSeconds(500)`, то есть опрос идёт раз в 8+ минут вместо 0,5 с. Причина в том, что в имени настройки нет единицы. Исправление: `TimeSpan` или `PollIntervalMs`.

## High
6. **`OutboxWorker`: `IOptions<OutboxOptions>` не даёт менять настройки на лету.** MR этого требует, а `IOptions` читается один раз. Нужен `IOptionsMonitor.CurrentValue` на каждой итерации. `_batchSize` при этом надо каждый раз зажимать в `[Min, Max]`. Если после reload конфиг окажется невалидным, `CurrentValue` бросит `OptionsValidationException` — его нужно обработать.
7. **`OutboxOptionsValidator` не зарегистрирован, `ValidateOnStart` нет.** Сейчас это мёртвый код.
8. **Валидатор не проверяет связь полей и границы.**
   - В Production `MinBatchSize 200` больше `MaxBatchSize 100`, и адаптивный батчинг молча отключается.
   - `MinBatchSize = 0` может навсегда зафиксировать `_batchSize` на 0, и воркер перестанет выбирать сообщения.
   - `PollInterval` не проверяется на `> 0`.
   - Тесты эти случаи не покрывают.
9. **`ExecuteAsync`: в цикле нет try/catch.** Первый же сбой БД при `StopHost` (поведение .NET 8 по умолчанию) останавливает хост.
10. **`appsettings.Staging.json`: `${NOTIFY_DB_PASSWORD}` не подставляется.** Конфигурация .NET такие плейсхолдеры не раскрывает, паролем станет буквальная строка.
11. **`tests/OutboxOptionsValidatorTests.cs` лежит внутри каталога проекта.** Worker SDK компилирует все `**/*.cs`, а xunit не подключён, поэтому сборка должна упасть. Это вывод по чтению кода, не по запуску.

## Medium
12. **Staging агрессивнее Production без объяснения.** На Staging `MaxInFlight 20`, на Production `5`, причина рядом не записана.
13. **`ThrottleService`: каждая задача ждёт сама по себе.** Фактический темп получается `MaxInFlight × PerMinute`. Нужен общий rate limiter.
14. **Гонка между несколькими экземплярами.** Нет `FOR UPDATE SKIP LOCKED` или concurrency token, поэтому возможны дубли писем.
15. **Отмена считается неудачной попыткой.** `OperationCanceledException` увеличивает `Attempts`, а финальный `SaveChangesAsync(ct)` с отменённым токеном падает, и состояние пачки теряется.

## Low
16. **Env-файлы повторяют дефолты.** Например `MaxBatchSize`, `MaxInFlight`, `MaxRetries` в Production и `MaxRetries` в Staging совпадают с базовым файлом.
17. **`SmtpMailSender`: новое SMTP-подключение на каждое письмо.**