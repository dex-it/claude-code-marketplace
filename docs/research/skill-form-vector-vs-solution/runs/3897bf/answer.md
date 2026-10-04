Нашёл 19 дефектов: 4 critical, 8 high, 5 medium и 2 low. С critical-проблемами сервис в текущем виде нерабочий: ни одно письмо не уходит, а неудачные письма помечаются отправленными. Сборку и тесты я не запускал, выводы сделаны по чтению кода и документированному поведению .NET 8. Тот же ответ записан в `_answer.md`.

## Critical

1. **`appsettings.Production.json`: в репозитории боевые секреты.** Открытым текстом лежат пароль прод-БД (`Password=Kx7!pQ2vR9wz`) и ключ SMTP-релея (`rl_live_9f3a1c77e2b04d6d`). Если просто удалить их из файла, они останутся в истории git. До мерджа оба секрета нужно сменить и передавать через переменные окружения (`ConnectionStrings__Notify`, `Smtp__Password`) или хранилище секретов.

2. **`Program.cs`: `SmtpOptions` привязаны к секции `"Mail"`, а в конфигурации она называется `"Smtp"`.** Значения остаются пустыми: `Host = null`, `Port = 0`, `FromAddress = null`. Поэтому `MailboxAddress.Parse(null)` в `SmtpMailSender.SendAsync` падает на каждой отправке во всех окружениях. Кроме того, `Host` и `FromAddress` объявлены как non-nullable `string` без значения по умолчанию и без валидации, так что при старте ошибку не видно.

3. **`ThrottleService.WaitAsync`: ключ `Throttle:MessagesPerMinute` не совпадает с конфигурацией (`Throttle:PerMinute`).** Для отсутствующего ключа `GetValue<int>` возвращает `0`, и `60_000 / 0` бросает `DivideByZeroException` на каждом письме. Исключение перехватывает `catch` в воркере, поэтому ни одно письмо не уходит, а в логе только предупреждения.

4. **`OutboxWorker.ProcessBatchAsync`: `SentAt = now` ставится и сохраняется до отправки.** Если отправка не удалась, увеличивается только `Attempts`, а `SentAt` остаётся заполненным. Выборка фильтрует по `SentAt == null`, поэтому неудачное письмо больше никогда не повторяется и числится отправленным: ретраи и `MaxRetries` не работают.

## High

5. **`OutboxWorker.ExecuteAsync`: `PollInterval = 500` передаётся в `TimeSpan.FromSeconds`.** Получается пауза 500 с (≈8,3 мин) вместо заявленных полсекунды. Причина в том, что у настройки нет единицы в имени. `PollInterval` не валидируется: при `0` цикл опрашивает БД без паузы.

6. **Конструктор `OutboxWorker` и `SmtpMailSender`: используется `IOptions<T>`, хотя по описанию MR значения должны меняться на лету.** `IOptions<T>` считывается один раз и после правки appsettings не обновляется. Нужен `IOptionsMonitor<T>.CurrentValue`. Отдельно: `_batchSize` при изменении `MaxBatchSize` заново не ограничивается.

7. **`Program.cs`: `OutboxOptionsValidator` нигде не зарегистрирован, `ValidateOnStart` нет.** Валидатор фактически мёртвый код, а тесты проверяют класс, который в приложении не используется.

8. **`OutboxOptionsValidator.Validate`: не проверяется `MinBatchSize <= MaxBatchSize`, и в проде это уже нарушено.** В проде стоит `MinBatchSize: 200` при `MaxBatchSize: 100`, из-за чего адаптивный батчинг молча отключён. Также не проверяются `MinBatchSize > 0` и `PollInterval > 0`. При `MinBatchSize = 0` размер пачки может упасть до 0 и остаться там навсегда: воркер перестанет выбирать сообщения.

9. **`appsettings.Staging.json`: `${NOTIFY_DB_PASSWORD}` не подставляется.** Конфигурация .NET не раскрывает переменные окружения внутри значений, поэтому в Npgsql уходит буквальная строка и подключение на staging падает.

10. **`OutboxWorker.ProcessBatchAsync`: гонка при нескольких экземплярах.** Выборка и захват строк — отдельные шаги без блокировки, поэтому два экземпляра могут отправить одно письмо дважды. Нужен `FOR UPDATE SKIP LOCKED` или атомарный `UPDATE … RETURNING`.

11. **`OutboxWorker.ExecuteAsync`: у цикла нет `try/catch`.** Любой временный сбой БД выходит из `ExecuteAsync`, а в .NET 8 это по умолчанию останавливает весь процесс (`StopHost`).

12. **`tests/OutboxOptionsValidatorTests.cs` лежит внутри проекта сервиса.** SDK компилирует все `**/*.cs`, а пакета xunit в `Notify.Worker.csproj` нет, поэтому сборка сервиса сломается.

## Medium

13. **`ThrottleService`: троттлинг не глобальный.** Каждая параллельная задача ждёт сама по себе, поэтому реальная скорость примерно в `MaxInFlight` раз выше лимита. Нужен общий rate limiter.
14. **`appsettings.Staging.json` агрессивнее прода:** `MaxInFlight` 20 против 5.
15. **`appsettings.Staging.json`: не заданы `Smtp:FromAddress`/`UserName`/`Password`, `Throttle` и `PollInterval`.** Наследуются значения из dev-конфига (`noreply@localhost`, отправка без аутентификации на порту 587).
16. **`ProcessBatchAsync`: `catch (Exception)` ловит `OperationCanceledException`.** При штатной остановке отменённые письма засчитываются как неудачные попытки.
17. **`OutboxOptionsValidator`: `MaxRetries = 0` проходит валидацию,** хотя с ним воркер ничего не выбирает.

## Low

18. **`SmtpMailSender.SendAsync`:** на каждое письмо открывается новое SMTP-соединение; StartTLS явно не требуется.
19. **`appsettings.json`:** учётные данные dev-БД в базовом файле подхватываются как запасное значение во всех окружениях.