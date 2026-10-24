Нашёл 21 дефект, из них 5 critical. В текущем виде сервис не доставит ни одного письма, а при сбоях отправки сообщения теряются молча. Код не менял, сборку и тесты не запускал, всё найдено чтением кода. Тот же текст записан в `_answer.md`.

## Critical

1. **`appsettings.Production.json`: секреты в репозитории.** Пароль БД (`Password=Kx7!pQ2vR9wz`) и пароль SMTP-релея (`rl_live_9f3a1c77e2b04d6d`) лежат открытым текстом.
   - **Почему дефект:** боевые учётные данные попадают в историю git.
   - **Что сделать:** оба секрета отозвать и перевыпустить, передавать через переменные окружения или secret store. Удаление из файла не поможет: секреты уже в истории.

2. **`OutboxWorker.ProcessBatchAsync`: сообщение помечается отправленным до отправки.** `SentAt = now` сохраняется в БД ещё до `SendAsync`. При ошибке растёт только `Attempts`, а `SentAt` остаётся заполненным.
   - **Почему дефект:** фильтр `SentAt == null` больше не выберет такое сообщение, поэтому любая неудачная отправка теряется молча. Ретраи фактически не работают, и `LockedUntil` бессмысленен.
   - **Что сделать:** до отправки ставить только `LockedUntil`, `SentAt` ставить после успешной отправки.

3. **`Program.cs`: неверное имя секции SMTP.** В коде `GetSection("Mail")`, а в конфигах секция называется `"Smtp"`.
   - **Почему дефект:** `SmtpOptions` остаётся пустым, и каждая отправка падает на `MailboxAddress.Parse(null)` и `ConnectAsync(null, 0)`. Ни одно письмо не уйдёт ни в одном окружении.

4. **`ThrottleService.WaitAsync`: неверное имя ключа.** Код читает `Throttle:MessagesPerMinute`, а в конфиге ключ называется `PerMinute`.
   - **Почему дефект:** читается 0, и `60_000 / perMinute` бросает `DivideByZeroException` на каждом письме. Вместе с п. 2 все сообщения теряются.

5. **`OutboxWorker.ExecuteAsync`: интервал опроса в секундах, а не в миллисекундах.** Код вызывает `TimeSpan.FromSeconds(o.PollInterval)` при значении `500`.
   - **Почему дефект:** вместо обещанных в MR 0,5 с воркер опрашивает outbox раз в 500 с (≈8 мин). Корень ошибки в том, что в имени настройки нет единицы измерения.

## High

6. **`OutboxWorker`: `IOptions` вместо `IOptionsMonitor`.** Значение вычисляется один раз при старте.
   - **Почему дефект:** MR требует менять `MaxInFlight` и размер пачки без рестарта, а с `IOptions` это не работает.
   - **Что ещё:** `_batchSize` не ограничивается новым `MaxBatchSize`, если его уменьшить на лету.

7. **`Program.cs` / `OutboxOptionsValidator`: валидатор нигде не зарегистрирован.** Нет ни регистрации в DI, ни `ValidateOnStart`, так что неверный конфиг всплывает только в рантайме.
   - **Что сделать:** `AddOptions<T>().Bind(...).ValidateOnStart()` плюс регистрация валидатора. Для `SmtpOptions` то же самое плюс `ValidateDataAnnotations`.

8. **`OutboxOptionsValidator.Validate`: не хватает проверок.**
   - **Нет инварианта `MinBatchSize <= MaxBatchSize`.** В Production сейчас 200 > 100, и адаптивный батчинг там молча отключён.
   - **Нет проверки `MinBatchSize > 0`.** При 0 размер пачки уменьшается до 0 и больше не растёт, воркер навсегда перестаёт выбирать сообщения.
   - **Нет проверки `PollInterval > 0`.** При 0 воркер крутит горячий цикл опроса БД.

9. **`appsettings.Staging.json`: плейсхолдер `${NOTIFY_DB_PASSWORD}` не подставится.** Конфигурация .NET не раскрывает переменные окружения внутри значений, поэтому уйдёт буквальная строка и подключение к БД не пройдёт.
   - **Что сделать:** переопределять всю строку через `ConnectionStrings__Notify`.

10. **`tests/OutboxOptionsValidatorTests.cs` лежит внутри каталога проекта.** SDK включает `**/*.cs` в компиляцию, а пакета xunit у сервиса нет.
    - **Почему дефект:** `using Xunit;` не соберётся, и сломается сборка самого сервиса.
    - **Что сделать:** вынести тесты в отдельный тестовый проект.

11. **`OutboxWorker.ProcessBatchAsync`: выборка без блокировки строк.** Нет ни `FOR UPDATE SKIP LOCKED`, ни concurrency token.
    - **Почему дефект:** при двух и более репликах (или при перекрытии во время деплоя) экземпляры возьмут одни и те же строки и разошлют дубликаты.

12. **`OutboxWorker.ExecuteAsync`: исключения в цикле не обрабатываются.**
    - **Почему дефект:** в .NET 8 по умолчанию `BackgroundServiceExceptionBehavior.StopHost`, поэтому кратковременный сбой БД останавливает весь хост.

## Medium

13. **`appsettings.Staging.json`: Staging агрессивнее Production.** `MaxInFlight` в Staging 20, в Production 5, и причина рядом не записана. Это нарушает правило команды.
14. **`ThrottleService`: лимит не общий.** Каждая параллельная задача спит отдельно, поэтому реальная скорость равна `MaxInFlight × PerMinute`. Для прода это 5 × 1200 = 6000 писем/мин вместо 1200. Нужен общий rate limiter (`System.Threading.RateLimiting`).
15. **`SmtpOptions`: non-nullable `Host`/`FromAddress` без значения из конфига.** Модификатор `required` здесь не поможет. Отсутствие значения ловят только `ValidateDataAnnotations` или валидатор вместе с `ValidateOnStart`.
16. **`ProcessBatchAsync`: при остановке сервиса отмена считается ошибкой отправки.**
    - **Почему дефект:** `catch (Exception)` ловит `OperationCanceledException`, и у сообщений растёт `Attempts`. Затем `SaveChangesAsync(ct)` с уже отменённым токеном падает, и состояние пачки не сохраняется.
    - **Что сделать:** `catch (Exception ex) when (ex is not OperationCanceledException)`.
17. **`appsettings.Staging.json`: не переопределён `Smtp:FromAddress`.** В Staging уйдёт `noreply@localhost`.

## Low

18. **Env-файлы дублируют значения по умолчанию.**
    - В Production: `MaxBatchSize`, `MaxInFlight`, `MaxRetries`.
    - В Staging: `MaxRetries`.
19. **`OutboxOptions.PollInterval`: нет единицы в имени.** Лучше `PollIntervalMs` или тип `TimeSpan`, как у `LockTimeout`.
20. **`SmtpMailSender.SendAsync`: новое SMTP-подключение и аутентификация на каждое письмо.**
21. **Тестов на новые правила валидации нет.** Нет и теста, что валидатор зарегистрирован в DI и срабатывает на старте.