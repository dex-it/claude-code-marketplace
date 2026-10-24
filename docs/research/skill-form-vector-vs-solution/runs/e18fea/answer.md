Нашёл 18 дефектов: 4 critical, 7 high, 3 medium, 4 low. В нынешнем виде сервис не отправит ни одного письма и молча пометит весь outbox как отправленный. Ответ также записан в `_answer.md`. Код не менял, сборку и тесты не запускал.

## Critical

1. **`appsettings.Production.json` — секреты в репозитории.** В файле лежат пароль БД `Kx7!pQ2vR9wz` и пароль SMTP-релея `rl_live_9f3a1c77e2b04d6d`. Они останутся в истории git навсегда, поэтому оба нужно **сменить**. Реальные значения задавать через переменные окружения или secret store, в файле оставить только плейсхолдеры.
2. **`Program.cs` — `SmtpOptions` читается из секции `"Mail"`, а в конфиге секция называется `"Smtp"`.** Опции остаются пустыми, и `MailboxAddress.Parse(null)` в `SmtpMailSender.SendAsync` падает на каждом письме.
3. **`ThrottleService.WaitAsync` — ключ `Throttle:MessagesPerMinute`, а в конфиге `Throttle:PerMinute`.** Значение приходит как 0, и `60_000 / 0` бросает `DivideByZeroException`. Это исключение перехватывает `catch` в воркере, так что ничего не отправляется, а в логе только warning'и.
4. **`OutboxWorker.ProcessBatchAsync` — `SentAt` ставится и сохраняется до отправки.** Если отправка упала, сообщение больше не попадёт в выборку, повторных попыток нет, `Attempts`/`MaxRetries` не работают. Если процесс упадёт между двумя `SaveChangesAsync`, вся пачка останется «отправленной». Вместе с п.2 и п.3 все сообщения в проде теряются. `SentAt` нужно ставить только после успешной отправки.

## High

5. **`OutboxWorker.ExecuteAsync` — `TimeSpan.FromSeconds(PollInterval)` при значении 500.** Опрос идёт раз в ≈8 минут, а не раз в полсекунды, как написано в MR. Нужна единица в имени (`PollIntervalMs`) и `FromMilliseconds`, либо формат TimeSpan.
6. **`OutboxWorker` — `IOptions<OutboxOptions>` в singleton-сервисе.** Он не видит изменений appsettings, поэтому обещанная в MR смена настроек на лету не работает. Нужен `IOptionsMonitor` и чтение `CurrentValue`. `ThrottleService` тоже переводить на опции.
7. **`OutboxOptionsValidator` не зарегистрирован, `ValidateOnStart` нет.** Зелёный тест проверяет код, который в работе никогда не вызывается. В самом валидаторе не хватает проверок `PollInterval > 0`, `MinBatchSize > 0`, `Min <= Max`. Кроме того, он пропускает `MaxRetries = 0`, а при нём не выбирается ни одно сообщение.
8. **`OutboxWorker.ExecuteAsync` — условие `MinBatchSize < MaxBatchSize` проверяется простым `if`, а в проде `Min=200`, `Max=100`.** Адаптивный размер пачки в проде молча выключен. Проверку нужно перенести в валидатор и в том же MR исправить prod-конфиг, иначе после регистрации валидатора прод упадёт на старте.
9. **`OutboxWorker.ExecuteAsync` — в цикле нет try/catch.** В .NET 8 по умолчанию стоит `StopHost`, поэтому одна временная ошибка БД останавливает весь сервис.
10. **`appsettings.Staging.json` — `Password=${NOTIFY_DB_PASSWORD}`.** .NET такие подстановки не раскрывает, в Npgsql уйдёт буквальная строка, и подключение к БД на staging не пройдёт авторизацию.
11. **`ProcessBatchAsync` — пачка забирается без блокировки.** Нет ни `FOR UPDATE SKIP LOCKED`, ни concurrency token. При двух репликах или во время rolling deploy письма уйдут дважды.

## Medium

12. **`ThrottleService`** — задержка считается для каждого вызова отдельно. При `MaxInFlight = N` реальная скорость в N раз выше лимита. Нужен общий rate limiter.
13. **`appsettings.Staging.json`** — `MaxInFlight: 20`, а в проде 5, причём причина нигде не указана.
14. **`ProcessBatchAsync`** — `catch (Exception)` ловит и `OperationCanceledException`. При обычной остановке сервиса прерванные отправки засчитываются как неудачные попытки.

## Low

15. **`SmtpOptions`** — `Host` и `FromAddress` объявлены как non-nullable, но без `required` и без валидации (предупреждение CS8618, в работе — NRE).
16. **env-файлы** повторяют значения по умолчанию: `MaxInFlight: 5` и `MaxRetries: 5` в prod, `MaxRetries: 5` в staging.
17. **`SmtpMailSender.SendAsync`** — для каждого письма заново открывается соединение и проходит авторизация.
18. **Staging** — `FromAddress` не переопределён, письма уйдут с `noreply@localhost`.