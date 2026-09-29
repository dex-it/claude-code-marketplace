Ревью готово: 19 находок, из них 4 critical и 6 high. Тот же ответ записан в `_answer.md`. Код не менял, сборку и тесты не запускал.

## Critical

1. **`appsettings.Production.json`: секреты в репозитории.**
   - Что не так: пароль БД (`Kx7!pQ2vR9wz`) и пароль SMTP-релея (`rl_live_9f3a1c77e2b04d6d`) лежат открытым текстом.
   - Почему дефект: раз они попали в git-историю, их нужно считать скомпрометированными.
   - Исправление: сменить оба пароля, брать значения из переменных окружения или secret store (например, `ConnectionStrings__Notify`, `Smtp__Password`).

2. **`OutboxWorker.ProcessBatchAsync`: `SentAt = now` ставится до отправки.**
   - Что не так: при ошибке `catch` делает только `Attempts++`, а `SentAt` остаётся заполненным.
   - Почему дефект: выборка берёт только `SentAt == null`, поэтому повторов нет, `MaxRetries` и `LockedUntil` фактически не работают. Если процесс упадёт между первым `SaveChanges` и отправкой, письма тоже останутся помеченными как отправленные. Итог: письма теряются молча.
   - Исправление: сначала захватывать строки через `LockedUntil`, `SentAt` писать только после успешной отправки, при ошибке снимать lock.

3. **`ThrottleService.WaitAsync`: неверный ключ конфигурации.**
   - Что не так: код читает `Throttle:MessagesPerMinute`, а в конфиге ключ `Throttle:PerMinute`. Значение получается 0, и `60_000 / 0` бросает `DivideByZeroException`.
   - Почему дефект: исключение ловит `catch` в воркере, поэтому падает каждая отправка. Вместе с п. 2 все письма помечаются отправленными, хотя ни одно не ушло.

4. **`Program.cs`: `SmtpOptions` привязан к секции `"Mail"`, а в конфиге она называется `"Smtp"`.**
   - Что не так: `Host` и `FromAddress` равны null, `Port` равен 0.
   - Почему дефект: `MailboxAddress.Parse(null)` падает на каждом письме, а валидации на старте нет, так что сервис стартует без ошибок.

## High

5. **`Program.cs`: `OutboxOptionsValidator` нигде не зарегистрирован.**
   - Что не так: нет регистрации в DI и нет `ValidateOnStart`, поэтому валидатор никогда не вызывается. Для `SmtpOptions` валидации нет совсем.
   - Исправление: `AddOptions<T>().Bind(section)`, валидатор или `ValidateDataAnnotations()`, плюс `.ValidateOnStart()` для обеих опций.

6. **`OutboxWorker`: используется `IOptions<OutboxOptions>`.**
   - Что не так: значение читается один раз. MR требует менять лимит параллельности и размер пачки на лету, без рестарта, а с `IOptions` это не работает.
   - Исправление: воркер — синглтон, поэтому `IOptionsSnapshot` не подойдёт, нужен `IOptionsMonitor`.
   - Дополнительно: `_batchSize` задаётся из `MaxBatchSize` один раз. При `Min >= Max` новое `MaxBatchSize` не применится даже с монитором.

7. **`OutboxWorker.ExecuteAsync`: `TimeSpan.FromSeconds(o.PollInterval)` при значении `500`.**
   - Что не так: по описанию MR опрос раз в полсекунды, а получается раз в 500 с (≈ 8,3 мин).

8. **`appsettings.Staging.json`: `${NOTIFY_DB_PASSWORD}` не подставится.**
   - Что не так: конфигурация .NET не раскрывает плейсхолдеры, пароль уйдёт в Npgsql буквально, и на staging аутентификация в БД не пройдёт.
   - Исправление: передавать строку подключения целиком через `ConnectionStrings__Notify`.

9. **`tests/OutboxOptionsValidatorTests.cs` попадает в основной проект.**
   - Что не так: SDK по умолчанию включает все `**/*.cs`. `using Xunit` без пакета xunit не компилируется, а отдельного тестового csproj нет.
   - Почему дефект: сервис в текущем виде не соберётся.

10. **`OutboxWorker.ExecuteAsync`: нет try/catch в цикле.**
    - Что не так: любая ошибка БД выходит из `ExecuteAsync`.
    - Почему дефект: в .NET 8 по умолчанию `BackgroundServiceExceptionBehavior.StopHost`, то есть хост останавливается целиком.

## Medium

11. **`OutboxOptionsValidator`: не проверяются `MinBatchSize` и соотношение min/max.**
    - В Production `MinBatchSize = 200`, `MaxBatchSize = 100`. Валидатор это пропускает, и адаптивный батчинг молча выключен.
    - При `MinBatchSize <= 0` размер пачки падает до 0, и воркер навсегда застревает на `Take(0)`.
    - Нужно добавить проверки `Min > 0`, `Min <= Max`, `PollInterval > 0` и тесты на них.

12. **`OutboxWorker.ProcessBatchAsync`: нет атомарного захвата строк.**
    - Что не так: обычный SELECT, затем UPDATE, без `FOR UPDATE SKIP LOCKED` и без concurrency token.
    - Почему дефект: при двух экземплярах воркера получатели получат дубли писем.

13. **`ThrottleService`: независимые `Task.Delay` в параллельных задачах не ограничивают скорость.**
    - Что не так: реальная скорость примерно в `MaxInFlight` раз выше заявленной. Настройка читается из `IConfiguration` в обход опций и валидации.
    - Исправление: общий rate limiter (например, `TokenBucketRateLimiter`) и типизированные опции с валидацией.

14. **`OutboxOptions.PollInterval`: в имени нет единицы измерения.**
    - Это и есть причина п. 7. Лучше тип `TimeSpan` или имя `PollIntervalMs`.

15. **`SmtpOptions`: non-nullable `Host` и `FromAddress` без значения и без валидации.**
    - Модификатор `required` здесь не поможет: биндер конфигурации его не проверяет.
    - Нужны `[Required]`, `ValidateDataAnnotations()` и `ValidateOnStart()`.

16. **`appsettings.Staging.json`: `MaxInFlight` на Staging (20) выше Production (5).**
    - Причина рядом не записана: Staging нагружает SMTP агрессивнее прода.

## Low

17. **Env-файлы дублируют дефолты.**
    - `MaxRetries: 5` в обоих файлах, `MaxInFlight: 5` и `MaxBatchSize: 100` в Production совпадают с `appsettings.json`.
    - Если потом поменять дефолт, в этих окружениях изменение молча не применится.

18. **`OutboxWorker.ProcessBatchAsync`: `catch (Exception)` ловит и `OperationCanceledException`.**
    - При остановке сервиса отмена засчитывается как неудачная попытка, и у писем тратятся ретраи.

19. **`SmtpMailSender.SendAsync`: новое SMTP-соединение и аутентификация на каждое письмо.**
    - Это дорого, и релей может посчитать такой трафик злоупотреблением. Лучше переиспользовать соединение в пределах пачки.